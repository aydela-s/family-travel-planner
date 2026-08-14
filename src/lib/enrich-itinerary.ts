import { CityConfig, Landmark, PRICING_DISCLAIMER } from "@/config/city-pricing";
import { detectCity } from "@/lib/city-detect";
import {
  addDays,
  alignTitleWithTimeOfDay,
  formatDayHeader,
  formatTripDateRange,
  getTimeOfDay,
  oneLineNote,
} from "@/lib/format";
import { estimateDailyTransport, formatTransportDisplay } from "@/lib/maps/directions";
import { buildRouteSegments } from "@/lib/maps/route-segments";
import { buildStaticMapUrl } from "@/lib/maps/static-map";
import { normalizeRawItinerary } from "@/lib/itinerary";
import { isGroceryActivity } from "@/lib/schedule/meal-planning";
import {
  extractLandmarkFromTitle,
  findLandmarkByName,
  validateActivityOpeningHours,
} from "@/lib/schedule/landmark-hours";
import { groceryLocationNearRoute } from "@/lib/planning-engine/meal-timing";
import { findRestaurantByName } from "@/lib/planning-engine/restaurant-picker";
import {
  activityUsesStayHome,
  stayHomeLocation,
} from "@/lib/planning-engine/stay-home";
import {
  prepareItineraryForEnrich,
  rescheduleEnrichedActivities,
  validateEnrichedDay,
} from "@/lib/schedule/fix-itinerary";
import { itemDurationMin, isUnpaidTimelineActivity } from "@/lib/schedule/timeline";
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

function normalizeActivity(activity: ItineraryActivity): ItineraryActivity {
  const timeOfDay = getTimeOfDay(activity.time);
  return {
    ...activity,
    timeOfDay,
    title: alignTitleWithTimeOfDay(activity.title, timeOfDay),
    notes: activity.notes ? oneLineNote(activity.notes) : activity.notes,
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

function applyGroceryLocations(
  activities: ItineraryActivity[],
  city: CityConfig,
  home: ActivityLocation | null,
): ItineraryActivity[] {
  return activities.map((activity, i) =>
    isGroceryActivity(activity)
      ? {
          ...activity,
          activityCost: 0,
          location: groceryLocationNearRoute(activities, i, city, home),
        }
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

/** Landmark names already used on earlier days (for adjust-day re-enrich). */
function landmarkNamesFromPreviousDays(itinerary: Itinerary, adjustDay: number): Set<string> {
  const names = new Set<string>();
  for (const day of itinerary.days) {
    if (day.day >= adjustDay) continue;
    for (const a of day.activities) {
      if (a.type !== "activity" || !a.location?.name) continue;
      if (isGroceryActivity(a) || isUnpaidTimelineActivity(a)) continue;
      names.add(a.location.name);
    }
  }
  return names;
}

async function enrichDay(
  rawDay: RawItinerary["days"][0],
  plan: TripPlan,
  city: CityConfig,
  dayIndex: number,
  tripExcludedLandmarks: Set<string> = new Set(),
): Promise<ItineraryDay> {
  const date = addDays(plan.startDate, dayIndex);
  const pickedLandmarks: Landmark[] = [];

  const activities: ItineraryActivity[] = rawDay.activities.map((a) => {
    const timeOfDay = getTimeOfDay(a.time);
    const act: ItineraryActivity = {
      ...a,
      timeOfDay,
      title: alignTitleWithTimeOfDay(a.title, timeOfDay),
    };

    const home = stayHomeLocation(plan);
    if (home && activityUsesStayHome(act)) {
      act.location = home;
      act.activityCost = 0;
      if (plan.stayPlaceId) act.placeId = plan.stayPlaceId;
      return act;
    }

    if (a.type === "activity") {
      // Grocery / strolls / breaks display as activities but are not paid attractions.
      if (isGroceryActivity(act) || isUnpaidTimelineActivity(act)) {
        const nearMatch = act.title.match(/\bnear (.+)$/i);
        const named = nearMatch?.[1] ? findLandmarkByName(city.landmarks, nearMatch[1]) : undefined;
        const anchor =
          named ?? pickedLandmarks[pickedLandmarks.length - 1] ?? city.landmarks[0]!;
        act.location = {
          name: named?.name ?? (nearMatch?.[1] ? nearMatch[1].trim() : anchor.name),
          lat: named?.lat ?? anchor.lat,
          lng: named?.lng ?? anchor.lng,
        };
        act.activityCost = 0;
        if (named?.placeId) act.placeId = named.placeId;
        return act;
      }
      // Resolve landmarks from the planned title only — never re-pick a different POI.
      const fromTitle = extractLandmarkFromTitle(a.title);
      const matched =
        (fromTitle ? findLandmarkByName(city.landmarks, fromTitle) : undefined) ??
        city.landmarks.find((l) => a.title.includes(l.name));
      if (matched) {
        pickedLandmarks.push(matched);
        tripExcludedLandmarks.add(matched.name);
        act.location = {
          name: matched.name,
          lat: matched.lat,
          lng: matched.lng,
        };
        act.activityCost = familyActivityCost(matched, plan.adults, plan.children);
        if (matched.placeId) act.placeId = matched.placeId;
        if (typeof matched.rating === "number") act.rating = matched.rating;
        if (typeof matched.reviewCount === "number") act.reviewCount = matched.reviewCount;
      } else {
        // Keep planned title; pin coords to last known stop or city center without swapping POIs.
        const anchor = pickedLandmarks[pickedLandmarks.length - 1] ?? city.landmarks[0]!;
        act.location = {
          name: fromTitle?.trim() || anchor.name,
          lat: anchor.lat,
          lng: anchor.lng,
        };
        act.activityCost = 0;
      }
    } else if (a.type === "meal") {
      const restaurant = findRestaurantByName(city, a.title);
      const titleLandmarkName = extractLandmarkFromTitle(a.title);
      const titleLandmark = titleLandmarkName
        ? findLandmarkByName(city.landmarks, titleLandmarkName)
        : undefined;
      if (restaurant) {
        act.location = {
          name: restaurant.name,
          lat: restaurant.lat,
          lng: restaurant.lng,
        };
        if (restaurant.placeId) act.placeId = restaurant.placeId;
        if (typeof restaurant.rating === "number") act.rating = restaurant.rating;
      } else if (titleLandmark) {
        // Honor "near Fleet Science Center" / café copy — don't fall back to landmarks[0].
        const cafeStyle = /café|cafe|pastries|bakery/i.test(a.title);
        act.location = {
          name: cafeStyle ? `${titleLandmark.name} café` : `${titleLandmark.name} area`,
          lat: titleLandmark.lat,
          lng: titleLandmark.lng,
        };
        if (titleLandmark.placeId) act.placeId = titleLandmark.placeId;
      } else {
        // Prefer anchoring meals near an already-picked activity, not a fresh random landmark.
        const anchor = pickedLandmarks[pickedLandmarks.length - 1] ?? city.landmarks[0]!;
        act.location = {
          name: `${anchor.name} area`,
          lat: anchor.lat + 0.004,
          lng: anchor.lng - 0.004,
        };
        if (anchor.placeId) act.placeId = anchor.placeId;
      }
      act.activityCost = 0;
    } else {
      const homeRest = stayHomeLocation(plan);
      if (homeRest) {
        act.location = homeRest;
        if (plan.stayPlaceId) act.placeId = plan.stayPlaceId;
      } else {
        const anchor = pickedLandmarks[0] ?? city.landmarks[0]!;
        act.location = {
          name: anchor.name,
          lat: anchor.lat,
          lng: anchor.lng,
        };
      }
      act.activityCost = 0;
    }

    return act;
  });

  const home = stayHomeLocation(plan);
  const withGroceryStop = maybeAddAccommodationGroceryStop(activities, plan, city, home);
  const located = applyGroceryLocations(withGroceryStop, city, home).map((act) => {
    // Cook-at-home / naps must stay at the rental — never inherit supermarket pins.
    if (home && activityUsesStayHome(act)) {
      return { ...act, location: home, activityCost: 0 };
    }
    return act;
  });

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

  const summary = summarizeDailyCost(withHoursNotes, lockedDailyTransport, city, plan, rawDay.day);
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
  transportNote?: string;
  /** Places-built or curated city override (FAM-59). */
  cityOverride?: CityConfig;
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
  const city = options?.cityOverride ?? detectCity(plan.destination);
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
    const tripExcluded = landmarkNamesFromPreviousDays(
      options.previousItinerary,
      options.adjustDay,
    );
    const newDay = await enrichDay(
      prepared.days[adjustIndex]!,
      plan,
      city,
      adjustIndex,
      tripExcluded,
    );
    days = options.previousItinerary.days.map((d) =>
      d.day === options.adjustDay ? newDay : d,
    );
  } else {
    const tripExcluded = new Set<string>();
    days = [];
    for (let index = 0; index < prepared.days.length; index++) {
      days.push(await enrichDay(prepared.days[index]!, plan, city, index, tripExcluded));
    }
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
    transportNote: options?.transportNote,
    budgetStyle: plan.budgetStyle,
    days,
  };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
