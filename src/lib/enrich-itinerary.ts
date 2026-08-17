import { CityConfig, Landmark, PRICING_DISCLAIMER } from "@/config/city-pricing";
import { detectCityFromPlan } from "@/lib/city-detect";
import {
  addDays,
  alignTitleWithTimeOfDay,
  formatDayHeader,
  formatTripDateRange,
  getTimeOfDay,
  oneLineNote,
} from "@/lib/format";
import { estimateDailyTransport, formatTransportDisplay } from "@/lib/maps/directions";
import { buildRouteSegments, scheduledSegmentMinutes } from "@/lib/maps/route-segments";
import { buildStaticMapUrl } from "@/lib/maps/static-map";
import { normalizeRawItinerary } from "@/lib/itinerary";
import { isGroceryActivity } from "@/lib/schedule/meal-planning";
import {
  extractLandmarkFromTitle,
  findLandmarkByName,
  hoursForDate,
  validateActivityOpeningHours,
} from "@/lib/schedule/landmark-hours";
import { groceryLocationNearRoute } from "@/lib/planning-engine/meal-timing";
import { recordConflict, type PlannerConflict } from "@/lib/planning-engine/conflicts";
import { findRestaurantByName } from "@/lib/planning-engine/restaurant-picker";
import { repairItineraryIntegrity } from "@/lib/planning-engine/itinerary-integrity";
import {
  repairDuplicateCategories,
} from "@/lib/planning-engine/validate-itinerary";
import {
  activityUsesStayHome,
  stayHomeLocation,
} from "@/lib/planning-engine/stay-home";
import {
  prepareItineraryForEnrich,
  rescheduleEnrichedActivities,
  validateEnrichedDay,
} from "@/lib/schedule/fix-itinerary";
import { classifyActivities } from "@/lib/schedule/classify-activity";
import { adultPriceForPlace } from "@/lib/maps/places-city-config";
import { itemDurationMin, isUnpaidTimelineActivity, parseTimeToMinutes } from "@/lib/schedule/timeline";
import { adjustmentRevisionKey } from "@/lib/schedule/adjust-day";
import { maybeAddAccommodationGroceryStop, applyMealActivityCosts, summarizeDailyCost, type DaySpendSummary } from "@/lib/pricing/budget";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import {
  allocateRouteSegmentCosts,
  injectTravelActivities,
} from "@/lib/pricing/transport-planner";
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

/**
 * Pin unnamed meals to the next (or previous) real stop so breakfast "near X"
 * does not taxi to a random catalog landmark.
 */
function pinMealsToNeighborStops(
  activities: ItineraryActivity[],
  home: ActivityLocation | null,
): ItineraryActivity[] {
  const neighbor = (from: number, dir: 1 | -1): ItineraryActivity | undefined => {
    for (let i = from + dir; i >= 0 && i < activities.length; i += dir) {
      const candidate = activities[i]!;
      if (candidate.type === "activity" && candidate.location && !isUnpaidTimelineActivity(candidate)) {
        return candidate;
      }
    }
    return undefined;
  };

  return activities.map((act, i) => {
    if (act.type !== "meal" || act.location) return act;
    const next = neighbor(i, 1);
    const prev = neighbor(i, -1);
    const anchor = next ?? prev;
    if (anchor?.location) {
      return {
        ...act,
        location: {
          name: `${anchor.location.name} area`,
          lat: anchor.location.lat,
          lng: anchor.location.lng,
        },
        placeId: anchor.placeId,
      };
    }
    if (home) return { ...act, location: home };
    return act;
  });
}

function delayFirstActivityToOpeningHours(
  activities: ItineraryActivity[],
  landmarks: Landmark[],
  visitDate: string,
): ItineraryActivity[] {
  const first = activities.find(
    (a) => a.type === "activity" && a.location && !isUnpaidTimelineActivity(a),
  );
  if (!first?.location) return activities;
  const landmark = findLandmarkByName(landmarks, first.location.name);
  if (!landmark) return activities;
  const hours = hoursForDate(landmark, visitDate);
  if (!hours) return activities;
  const open = parseTimeToMinutes(hours.open);
  if (open <= parseTimeToMinutes(first.time)) return activities;
  return activities.map((a) => (a === first ? { ...a, time: hours.open } : a));
}

/**
 * HARD RULE: the same venue must not appear twice on one day. With naps that
 * would send the family home and then taxi them back to the morning stop.
 */
function dropSameDayVenueRepeats(activities: ItineraryActivity[]): ItineraryActivity[] {
  const seen = new Set<string>();
  const out: ItineraryActivity[] = [];
  for (const activity of activities) {
    if (activity.type !== "activity" || isUnpaidTimelineActivity(activity)) {
      out.push(activity);
      continue;
    }
    const key = (activity.location?.name ?? activity.title).trim().toLowerCase();
    if (!key) {
      out.push(activity);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(activity);
  }
  return out;
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
  conflicts?: PlannerConflict[],
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
        // Prefer the landmark named in the title ("Break at Belmont Park") — do not
        // inherit the previous paid stop's pin (Kate Sessions → Belmont bug).
        const fromTitle = extractLandmarkFromTitle(act.title);
        const named =
          (fromTitle ? findLandmarkByName(city.landmarks, fromTitle) : undefined) ??
          city.landmarks.find((l) => act.title.includes(l.name));
        const anchor =
          named ?? pickedLandmarks[pickedLandmarks.length - 1] ?? city.landmarks[0]!;
        act.location = {
          name: named?.name ?? (fromTitle?.trim() || `${anchor.name} area`),
          lat: named?.lat ?? anchor.lat,
          lng: named?.lng ?? anchor.lng,
        };
        act.activityCost = 0;
        if (named?.placeId) act.placeId = named.placeId;
        return act;
      }
      // Resolve landmarks from the planned title only — never re-pick a different POI
      // unless that POI was already used on an earlier day (HARD no-reuse rule).
      const fromTitle = extractLandmarkFromTitle(a.title);
      let matched =
        (fromTitle ? findLandmarkByName(city.landmarks, fromTitle) : undefined) ??
        city.landmarks.find((l) => a.title.includes(l.name));
      if (matched && tripExcludedLandmarks.has(matched.name)) {
        const replacement = city.landmarks.find(
          (l) =>
            !tripExcludedLandmarks.has(l.name) &&
            l.interestTags.some((t) => (matched!.interestTags ?? []).includes(t)),
        );
        matched = replacement;
      }
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
        if (matched.interestTags?.length) act.interestTags = matched.interestTags;
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
        if (typeof restaurant.reviewCount === "number") act.reviewCount = restaurant.reviewCount;
      } else if (titleLandmark) {
        // Honor "near Fleet Science Center" / café copy — don't fall back to landmarks[0].
        const cafeStyle = /café|cafe|pastries|bakery/i.test(a.title);
        act.location = {
          name: cafeStyle ? `${titleLandmark.name} café` : `${titleLandmark.name} area`,
          lat: titleLandmark.lat,
          lng: titleLandmark.lng,
        };
        if (titleLandmark.placeId) act.placeId = titleLandmark.placeId;
      }
      act.activityCost = 0;
    } else {
      const homeRest = stayHomeLocation(plan);
      if (homeRest) {
        act.location = homeRest;
        if (plan.stayPlaceId) act.placeId = plan.stayPlaceId;
      } else {
        const anchor =
          pickedLandmarks[pickedLandmarks.length - 1] ?? city.landmarks[0]!;
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
  const withGroceryStop = maybeAddAccommodationGroceryStop(activities, plan, city, home, rawDay.day);
  const located = pinMealsToNeighborStops(
    applyGroceryLocations(withGroceryStop, city, home).map((act) => {
      // Cook-at-home / naps must stay at the rental — never inherit supermarket pins.
      if (home && activityUsesStayHome(act)) {
        return { ...act, location: home, activityCost: 0 };
      }
      return act;
    }),
    home,
  );

  // HARD RULE gate: at most one activity per category per day. Classification
  // first so a stop that arrived without catalog tags still competes for its
  // category; both run before routing/pricing so a swapped stop is costed and
  // routed like any other.
  const classified = classifyActivities(located, city).map((act) => {
    if (act.type !== "activity" || !act.location || isUnpaidTimelineActivity(act)) return act;
    const tags = act.interestTags ?? [];
    const price = adultPriceForPlace(act.location.name, tags, null);
    if (price <= 0) return act;
    // Re-price paid water parks / aquatic centers that were wrongly tagged free parks.
    if ((act.activityCost ?? 0) > 0) return act;
    const landmark = city.landmarks.find(
      (l) => l.name.toLowerCase() === act.location!.name.toLowerCase(),
    );
    return {
      ...act,
      activityCost: familyActivityCost(
        landmark ?? { adultPrice: price },
        plan.adults,
        plan.children,
      ),
    };
  });
  const withoutDupVenues = dropSameDayVenueRepeats(classified);
  const deduped = repairDuplicateCategories(withoutDupVenues, plan, city, {
    usedNames: tripExcludedLandmarks,
  });
  for (const a of deduped) {
    if (a.location?.name) tripExcludedLandmarks.add(a.location.name);
  }

  const timedForHours = delayFirstActivityToOpeningHours(deduped, city.landmarks, date);

  const { routeSegments, totalKm, segmentCosts, segmentDurations } = await buildRouteSegments(
    timedForHours,
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

  const scheduledActivities = rescheduleEnrichedActivities(timedForHours, plan, segmentDurations).map(
    normalizeActivity,
  );

  // The day's real date matters: a venue closed on Mondays is only a problem on
  // a Monday. Without it every weekday schedule collapsed to the default hours.
  const hoursIssues = validateActivityOpeningHours(
    scheduledActivities,
    city.landmarks,
    (a) => itemDurationMin(a, plan),
    date,
  );
  for (const v of hoursIssues) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[schedule:hours] ${v.code}: ${v.message}`);
    }
    // Reliable hours that say "closed" are a hard-rule failure, not a caveat.
    if (v.hoursReliable) {
      recordConflict(conflicts, {
        code: "no_open_venue",
        rule: "venue_closed",
        scope: { day: rawDay.day },
        message: v.message,
        options: [
          {
            kind: "venue",
            name: v.landmarkName,
            violates: ["venue_closed"],
            reason:
              v.code === "closed_that_day"
                ? `${v.landmarkName} is closed on ${formatDayHeader(date).split(",")[0]}`
                : `${v.landmarkName} is not open at the scheduled time`,
          },
        ],
        chosen: {
          kind: "venue",
          name: v.landmarkName,
          violates: ["venue_closed"],
          reason: v.message,
        },
      });
    }
  }
  const withHoursNotes = applyOpeningHoursNotes(scheduledActivities, hoursIssues, city.landmarks);

  const pricedSegments = allocateRouteSegmentCosts(routeSegments, plan, city);
  const withMealCosts = applyMealActivityCosts(withHoursNotes, city, plan);
  const withTravel = injectTravelActivities(
    withMealCosts,
    pricedSegments,
    plan,
    city.currencySymbol,
  ).map(normalizeActivity);

  const summary = summarizeDailyCost(withTravel, lockedDailyTransport, city, plan, rawDay.day);
  const costBreakdown = buildCostBreakdown(summary, city.currency);
  const transportCost = costBreakdown.transport;

  const mapLocations = withTravel
    .filter((a) => a.type !== "travel" && a.location)
    .map((a) => a.location!);

  const dayResult: ItineraryDay = {
    day: rawDay.day,
    date,
    weekday: formatDayHeader(date).split(",")[0],
    formattedDate: formatDayHeader(date),
    activities: withTravel,
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
    routeSegments: pricedSegments,
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
  /** Conflicts already reported by the planner (planTrip result). */
  conflicts?: PlannerConflict[];
};

function validateBeforeDisplay(days: ItineraryDay[], plan: TripPlan): ItineraryDay[] {
  return days.map((day) => {
    const issues = validateEnrichedDay(
      {
        ...day,
        activities: day.activities.filter((a) => a.type !== "travel"),
      },
      plan,
    );
    if (issues.length === 0) return day;
    const withoutTravel = day.activities.filter((a) => a.type !== "travel");
    const rescheduled = rescheduleEnrichedActivities(
      withoutTravel,
      plan,
      scheduledSegmentMinutes(day.routeSegments, plan),
    );
    return {
      ...day,
      activities: injectTravelActivities(rescheduled, day.routeSegments ?? [], plan),
    };
  });
}

export async function enrichItinerary(
  raw: RawItinerary,
  plan: TripPlan,
  options?: EnrichOptions,
): Promise<Itinerary> {
  const city = options?.cityOverride ?? detectCityFromPlan(plan);
  const normalized = normalizeRawItinerary(raw, plan);
  const prepared = prepareItineraryForEnrich(
    normalized,
    plan,
    options?.adjustDay,
    options?.adjustNote,
  );

  let days: ItineraryDay[];
  const conflicts: PlannerConflict[] = [...(options?.conflicts ?? [])];

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
      conflicts,
    );
    days = options.previousItinerary.days.map((d) =>
      d.day === options.adjustDay ? newDay : d,
    );
  } else {
    const tripExcluded = new Set<string>();
    days = [];
    for (let index = 0; index < prepared.days.length; index++) {
      days.push(
        await enrichDay(prepared.days[index]!, plan, city, index, tripExcluded, conflicts),
      );
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

  const repaired = repairItineraryIntegrity(days, plan, city);
  days = repaired.days;
  if (process.env.NODE_ENV === "development") {
    for (const violation of repaired.violations) {
      console.warn(`[itinerary] ${violation.code}: ${violation.message}`);
    }
  }

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
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
