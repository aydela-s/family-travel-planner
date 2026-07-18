import { CityConfig, Landmark, PRICING_DISCLAIMER } from "@/config/city-pricing";
import { detectCity } from "@/lib/city-detect";
import {
  addDays,
  alignTitleWithTimeOfDay,
  formatDayHeader,
  formatTripDateRange,
  getTimeOfDay,
} from "@/lib/format";
import { estimateDailyTransport, formatTransportDisplay } from "@/lib/maps/directions";
import { buildRouteSegments } from "@/lib/maps/route-segments";
import { buildStaticMapUrl } from "@/lib/maps/static-map";
import { normalizeRawItinerary } from "@/lib/itinerary";
import { pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import { isGroceryActivity } from "@/lib/schedule/meal-planning";
import {
  findLandmarkByName,
  validateActivityOpeningHours,
} from "@/lib/schedule/landmark-hours";
import { groceryLocationNearRoute } from "@/lib/planning-engine/meal-timing";
import {
  prepareItineraryForEnrich,
  rescheduleEnrichedActivities,
  validateEnrichedDay,
} from "@/lib/schedule/fix-itinerary";
import { itemDurationMin, parseTimeToMinutes } from "@/lib/schedule/timeline";
import { adjustmentRevisionKey } from "@/lib/schedule/adjust-day";
import { maybeAddAccommodationGroceryStop, summarizeDailyCost, type DaySpendSummary } from "@/lib/pricing/budget";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import { TripPlan } from "@/types/trip-plan";
import {
  ActivityLocation,
  DayCostBreakdown,
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
  RawItinerary,
} from "@/types/itinerary";

function landmarkLocation(landmark: Landmark, slotIndex: number, day: number): ActivityLocation {
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

function buildCostBreakdown(summary: DaySpendSummary, currency: string): DayCostBreakdown {
  return {
    food: summary.food,
    transport: summary.transport,
    activities: summary.activities,
    total: summary.total,
    currency,
    note: summary.note,
  };
}

function applyGroceryLocations(activities: ItineraryActivity[], city: CityConfig): ItineraryActivity[] {
  return activities.map((activity, i) =>
    isGroceryActivity(activity)
      ? { ...activity, location: groceryLocationNearRoute(activities, i, city) }
      : activity,
  );
}

/** Surface residual outside-hours visits as activity notes (selection prefers open stops first). */
function applyOpeningHoursNotes(
  activities: ItineraryActivity[],
  issues: ReturnType<typeof validateActivityOpeningHours>,
  landmarks: Landmark[],
): ItineraryActivity[] {
  if (issues.length === 0) return activities;

  const byLandmark = new Map(issues.map((issue) => [issue.landmarkName.toLowerCase(), issue]));

  return activities.map((activity) => {
    if (activity.type !== "activity") return activity;
    const name = activity.location?.name;
    if (!name) return activity;
    const issue = byLandmark.get(name.toLowerCase());
    if (!issue) return activity;

    const landmark = findLandmarkByName(landmarks, name);
    const hours = landmark
      ? `${landmark.openingHours.open}–${landmark.openingHours.close}`
      : "listed hours";
    const tip = `Confirm hours before you go — this visit may fall outside typical open times (${hours}).`;
    return {
      ...activity,
      notes: activity.notes ? `${activity.notes} ${tip}` : tip,
    };
  });
}

async function enrichDay(
  rawDay: RawItinerary["days"][0],
  plan: TripPlan,
  city: CityConfig,
  dayIndex: number,
): Promise<ItineraryDay> {
  const date = addDays(plan.startDate, dayIndex);
  let activitySlot = 0;
  const pickedLandmarks: Landmark[] = [];

  const activities: ItineraryActivity[] = rawDay.activities.map((a) => {
    const timeOfDay = getTimeOfDay(a.time);
    const act: ItineraryActivity = {
      ...a,
      timeOfDay,
      title: alignTitleWithTimeOfDay(a.title, timeOfDay),
    };

    if (a.type === "activity") {
      const startMin = parseTimeToMinutes(a.time);
      const endMin = startMin + itemDurationMin(a, plan);
      const landmark = pickLandmarkForFamily(city, plan, rawDay.day, activitySlot, pickedLandmarks, {
        startMin,
        endMin,
      });
      pickedLandmarks.push(landmark);
      activitySlot += 1;
      act.location = landmarkLocation(landmark, activitySlot, rawDay.day);
      act.activityCost = familyActivityCost(landmark.adultPrice, plan.adults, plan.children);
    } else if (a.type === "meal") {
      const mealLandmark = pickLandmarkForFamily(
        city,
        plan,
        rawDay.day,
        10 + activitySlot,
        pickedLandmarks,
      );
      act.location = {
        name: `${mealLandmark.name} area`,
        lat: mealLandmark.lat + 0.004,
        lng: mealLandmark.lng - 0.004,
      };
      act.activityCost = 0;
    } else {
      const restLandmark = pickLandmarkForFamily(
        city,
        plan,
        rawDay.day,
        20 + activitySlot,
        pickedLandmarks,
      );
      act.location = landmarkLocation(restLandmark, activitySlot + 2, rawDay.day);
      act.activityCost = 0;
    }

    return act;
  });

  const withGroceryStop = maybeAddAccommodationGroceryStop(activities, plan, city);
  const located = applyGroceryLocations(withGroceryStop, city);

  const { routeSegments, totalKm, segmentCosts, segmentDurations } = await buildRouteSegments(
    located,
    city,
    plan,
  );

  const transportEstimate = estimateDailyTransport(
    plan.transportationType,
    city,
    plan,
    segmentCosts,
    totalKm,
  );

  const lockedDailyTransport = transportEstimate.cost;

  const scheduledActivities = rescheduleEnrichedActivities(located, plan, segmentDurations).map(
    normalizeActivity,
  );

  const hoursIssues = validateActivityOpeningHours(scheduledActivities, city.landmarks, (a) =>
    itemDurationMin(a, plan),
  );
  for (const v of hoursIssues) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[schedule:hours] ${v.code}: ${v.message}`);
    }
  }
  const withHoursNotes = applyOpeningHoursNotes(scheduledActivities, hoursIssues, city.landmarks);

  const summary = summarizeDailyCost(withHoursNotes, lockedDailyTransport, city, plan);
  const costBreakdown = buildCostBreakdown(summary, city.currency);
  const transportCost = costBreakdown.transport;

  const mapLocations = withHoursNotes
    .filter((a) => a.location)
    .map((a) => a.location!);

  const dayResult: ItineraryDay = {
    day: rawDay.day,
    date,
    weekday: formatDayHeader(date).split(",")[0],
    formattedDate: formatDayHeader(date),
    activities: withHoursNotes,
    costBreakdown,
    accommodationTips: summary.accommodationTips,
    costs: costBreakdown,
    metrics: {
      steps: transportEstimate.steps,
      distanceKm: transportEstimate.distanceKm ?? totalKm,
      fuelCost: transportEstimate.fuelCost,
      transportCost,
      transportLabel: formatTransportDisplay(
        plan.transportationType,
        transportEstimate.label,
        transportCost,
        city.currencySymbol,
      ),
    },
    routeSegments,
    mapUrl: buildStaticMapUrl(mapLocations),
  };

  return dayResult;
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
    const segmentDurations = day.routeSegments.map((s) => s.durationMin);
    return {
      ...day,
      activities: rescheduleEnrichedActivities(day.activities, plan, segmentDurations),
    };
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

  let days: ItineraryDay[];

  if (options?.adjustDay && options.previousItinerary) {
    const adjustIndex = prepared.days.findIndex((d) => d.day === options.adjustDay);
    const newDay = await enrichDay(prepared.days[adjustIndex], plan, city, adjustIndex);
    days = options.previousItinerary.days.map((d) =>
      d.day === options.adjustDay ? newDay : d,
    );
  } else {
    days = await Promise.all(
      prepared.days.map((d, index) => enrichDay(d, plan, city, index)),
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
    tripStartFormatted: formatTripDateRange(plan.startDate, plan.endDate),
    currency: city.currency,
    currencySymbol: city.currencySymbol,
    pricingDisclaimer: PRICING_DISCLAIMER,
    budgetStyle: plan.budgetStyle,
    days,
  };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
