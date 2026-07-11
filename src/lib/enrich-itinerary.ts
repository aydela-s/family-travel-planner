import { CityConfig, PRICING_DISCLAIMER } from "@/config/city-pricing";
import { detectCity } from "@/lib/city-detect";
import {
  addDays,
  alignTitleWithTimeOfDay,
  formatDayHeader,
  formatTripDate,
  getTimeOfDay,
} from "@/lib/format";
import { getDirections, estimateDailyTransport, formatTransportDisplay } from "@/lib/maps/directions";
import { buildStaticMapUrl } from "@/lib/maps/static-map";
import { normalizeRawItinerary } from "@/lib/itinerary";
import { pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import { finalizeEnrichedDay, prepareItineraryForEnrich, scheduleEnrichedActivities, validateEnrichedDay } from "@/lib/schedule/fix-itinerary";
import { adjustmentRevisionKey } from "@/lib/schedule/adjust-day";
import {
  convertBudgetToLocal,
  enforceDailyBudget,
  estimatePreliminaryUsage,
  getBudgetBalanceNote,
  pickLandmarkPrice,
} from "@/lib/pricing/budget";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import { TripPlan } from "@/types/trip-plan";
import {
  ActivityLocation,
  DayCostBreakdown,
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
  RawItinerary,
  RouteSegment,
} from "@/types/itinerary";

function pickLandmarkForActivity(
  city: CityConfig,
  plan: TripPlan,
  dayNumber: number,
  slotIndex: number,
  budgetCapLocal: number,
): CityConfig["landmarks"][0] {
  return pickLandmarkForFamily(city, plan, dayNumber, slotIndex, budgetCapLocal);
}

function landmarkLocation(landmark: CityConfig["landmarks"][0], slotIndex: number, day: number): ActivityLocation {
  const offset = (slotIndex * 0.006 + day * 0.003) % 0.015;
  return {
    name: landmark.name,
    lat: landmark.lat + offset,
    lng: landmark.lng - offset,
  };
}

function normalizeActivity(activity: ItineraryActivity): ItineraryActivity {
  const timeOfDay = getTimeOfDay(activity.time);
  return {
    ...activity,
    timeOfDay,
    title: alignTitleWithTimeOfDay(activity.title, timeOfDay),
  };
}

function buildCostBreakdown(
  enforced: ReturnType<typeof enforceDailyBudget>,
  currency: string,
): DayCostBreakdown {
  const total = enforced.food + enforced.transport + enforced.activities;
  return {
    food: enforced.food,
    transport: enforced.transport,
    activities: enforced.activities,
    total,
    currency,
    budgetCap: enforced.budgetCap,
    onBudget: enforced.onBudget && total <= enforced.budgetCap,
    budgetNote: getBudgetBalanceNote(enforced.budgetUsagePercentage),
  };
}

async function enrichDay(
  rawDay: RawItinerary["days"][0],
  plan: TripPlan,
  city: CityConfig,
  dayIndex: number,
  budgetCapLocal: number,
  preliminaryUsage: number,
): Promise<ItineraryDay> {
  const date = addDays(plan.startDate, dayIndex);
  let activitySlot = 0;

  const activities: ItineraryActivity[] = rawDay.activities.map((a) => {
    const timeOfDay = getTimeOfDay(a.time);
    const act: ItineraryActivity = {
      ...a,
      timeOfDay,
      title: alignTitleWithTimeOfDay(a.title, timeOfDay),
    };

    if (a.type === "activity") {
      const landmark = pickLandmarkForActivity(city, plan, rawDay.day, activitySlot, budgetCapLocal);
      activitySlot += 1;
      act.location = landmarkLocation(landmark, activitySlot, rawDay.day);
      const adultPrice = pickLandmarkPrice(
        landmark.adultPrice,
        budgetCapLocal,
        plan.transportationType,
      );
      act.activityCost = familyActivityCost(adultPrice, plan.adults, plan.children);
    } else if (a.type === "meal") {
      const mealLandmark = city.landmarks[(rawDay.day + activitySlot) % city.landmarks.length];
      act.location = {
        name: `${mealLandmark.name} area`,
        lat: mealLandmark.lat + 0.004,
        lng: mealLandmark.lng - 0.004,
      };
      act.activityCost = 0;
    } else {
      const restLandmark = city.landmarks[(rawDay.day + activitySlot + 1) % city.landmarks.length];
      act.location = landmarkLocation(restLandmark, activitySlot + 2, rawDay.day);
      act.activityCost = 0;
    }

    return act;
  });

  const locActivities = activities.filter((a) => a.location);
  const routeSegments: RouteSegment[] = [];
  let totalKm = 0;
  const segmentCosts: number[] = [];

  for (let i = 0; i < locActivities.length - 1; i++) {
    const from = locActivities[i].location!;
    const to = locActivities[i + 1].location!;
    const dir = await getDirections(
      city,
      from,
      to,
      plan.transportationType,
      i % city.taxiProviders.length,
    );
    totalKm += dir.distanceKm;
    segmentCosts.push(plan.transportationType === "taxis" ? dir.cost : 0);
    routeSegments.push({
      from: from.name,
      to: to.name,
      distanceKm: dir.distanceKm,
      durationMin: dir.durationMin,
      cost: dir.cost,
      provider: dir.provider || undefined,
    });
  }

  const transportEstimate = estimateDailyTransport(
    plan.transportationType,
    city,
    segmentCosts,
    totalKm,
    plan.walkingLimit,
  );

  const lockedDailyTransport = transportEstimate.cost;

  const enforced = enforceDailyBudget(
    budgetCapLocal,
    city.currency,
    plan.transportationType,
    activities,
    0,
    lockedDailyTransport,
    plan,
    city,
    preliminaryUsage,
  );

  const adjustedActivities = enforced.activitiesAdjusted.map(normalizeActivity);
  const segmentDurations = routeSegments.map((s) => s.durationMin);
  const scheduledActivities = scheduleEnrichedActivities(
    adjustedActivities,
    plan,
    segmentDurations,
  ).map(normalizeActivity);

  const costBreakdown = buildCostBreakdown(enforced, city.currency);
  const transportCost = costBreakdown.transport;

  const mapLocations = scheduledActivities
    .filter((a) => a.location)
    .map((a) => a.location!);

  const movementLabel =
    enforced.optimizationFlags.transportReduced
      ? `Budget mode: ${enforced.effectiveTransport || "walking"} · ${transportEstimate.label}`
      : transportEstimate.label;

  const dayResult: ItineraryDay = {
    day: rawDay.day,
    date,
    weekday: formatDayHeader(date).split(",")[0],
    formattedDate: formatDayHeader(date),
    activities: scheduledActivities,
    costBreakdown,
    budgetUsagePercentage: enforced.budgetUsagePercentage,
    costSavingTips: enforced.costSavingTips,
    accommodationTips: enforced.accommodationTips,
    costs: costBreakdown,
    metrics: {
      steps: transportEstimate.steps,
      distanceKm: transportEstimate.distanceKm ?? totalKm,
      fuelCost: transportEstimate.fuelCost,
      transportCost,
      transportLabel: formatTransportDisplay(
        plan.transportationType,
        movementLabel,
        transportCost,
        city.currencySymbol,
      ),
    },
    routeSegments,
    mapUrl: buildStaticMapUrl(mapLocations),
  };

  return finalizeEnrichedDay(dayResult, plan);
}

export type EnrichOptions = {
  adjustDay?: number;
  adjustAction?: import("@/lib/planning-engine/adjust-types").AdjustActionId;
  adjustNote?: string;
  previousItinerary?: Itinerary;
};

function validateBeforeDisplay(days: ItineraryDay[], plan: TripPlan): ItineraryDay[] {
  return days.map((day) => {
    const issues = validateEnrichedDay(day, plan);
    if (issues.length === 0) return day;
    return finalizeEnrichedDay(day, plan);
  });
}

export async function enrichItinerary(
  raw: RawItinerary,
  plan: TripPlan,
  options?: EnrichOptions,
): Promise<Itinerary> {
  const city = detectCity(plan.destination);
  const normalized = normalizeRawItinerary(raw, plan);
  const prepared = prepareItineraryForEnrich(
    normalized,
    plan,
    options?.adjustDay,
    options?.adjustNote,
  );
  const budgetCapLocal = convertBudgetToLocal(plan.budgetPerDay, city.currency);
  const preliminaryUsage = estimatePreliminaryUsage(city, plan, budgetCapLocal);

  let days: ItineraryDay[];

  if (options?.adjustDay && options.previousItinerary) {
    const adjustIndex = prepared.days.findIndex((d) => d.day === options.adjustDay);
    const newDay = await enrichDay(
      prepared.days[adjustIndex],
      plan,
      city,
      adjustIndex,
      budgetCapLocal,
      preliminaryUsage,
    );
    days = options.previousItinerary.days.map((d) =>
      d.day === options.adjustDay ? newDay : d,
    );
  } else {
    days = await Promise.all(
      prepared.days.map((d, index) =>
        enrichDay(d, plan, city, index, budgetCapLocal, preliminaryUsage),
      ),
    );
  }

  if (options?.adjustDay && options.previousItinerary) {
    const previousDay = options.previousItinerary.days.find((d) => d.day === options.adjustDay);
    const newDay = days.find((d) => d.day === options.adjustDay);
    if (previousDay && newDay && (options.adjustAction || options.adjustNote)) {
      const prevKey = adjustmentRevisionKey(
        previousDay.activities.map(({ time, title, type, notes }) => ({ time, title, type, notes })),
      );
      const newKey = adjustmentRevisionKey(
        newDay.activities.map(({ time, title, type, notes }) => ({ time, title, type, notes })),
      );
      if (prevKey === newKey) {
        throw new Error("Adjusted day did not change — try “Add an activity” or “Fewer activities”.");
      }
    }
  }

  days = validateBeforeDisplay(days, plan);

  return {
    destination: plan.destination,
    destinationCity: city.name,
    tripStartFormatted: formatTripDate(plan.startDate),
    currency: city.currency,
    currencySymbol: city.currencySymbol,
    pricingDisclaimer: PRICING_DISCLAIMER,
    familyBudgetPerDayUsd: plan.budgetPerDay,
    familyBudgetPerDayLocal: budgetCapLocal,
    days,
  };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
