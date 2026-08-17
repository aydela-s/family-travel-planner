import type { CityConfig, Landmark, LandmarkInterestTag } from "@/config/city-pricing";
import { haversineKm } from "@/lib/maps/travel-estimate";
import { dayActivityCategories } from "@/lib/planning-engine/staged/landmark-experience";
import { mealDetourLimits } from "@/lib/planning-engine/restaurant-picker";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import { estimateMealPartyCostForActivity } from "@/lib/pricing/budget";
import { estimateDrivingLegCost } from "@/lib/pricing/transport-planner";
import {
  classifyActivityInterestTags,
  inferInterestTagsFromName,
  isCategorizableActivity,
} from "@/lib/schedule/classify-activity";
import { suggestActivityTitle } from "@/lib/schedule/family-profile";
import {
  INTEREST_LABEL_TO_TAGS,
  interestSourceLabels,
  interestTagsFromPlan,
} from "@/lib/schedule/interest-map";
import { isUnpaidTimelineActivity } from "@/lib/schedule/timeline";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

export type ItineraryViolation = {
  code:
    | "duplicate_day_category"
    | "unselected_category_filler"
    | "uncovered_selected_interest"
    | "restaurant_detour"
    | "distance_not_in_miles"
    | "meal_cost_mismatch"
    | "transport_cost_mismatch"
    | "activity_reused";
  message: string;
  day?: number;
};

/** Real attractions only — strolls, grocery runs and breaks are not categorized. */
export function scheduledAttractions(day: ItineraryDay): ItineraryActivity[] {
  return day.activities.filter(
    (a) => a.type === "activity" && !isUnpaidTimelineActivity(a) && a.interestTags?.length,
  );
}

/**
 * Stops the day-uniqueness rule applies to. Wider than `scheduledAttractions`:
 * a stop with no catalog tags still counts once its name resolves to a category.
 */
function categoryBearingStops(day: ItineraryDay): ItineraryActivity[] {
  return day.activities.filter(
    (a) =>
      isCategorizableActivity(a) &&
      (a.interestTags?.length || categoriesForActivity(a).size > 0),
  );
}

function categoriesForActivity(activity: ItineraryActivity): Set<string> {
  // An untagged stop is classified from its venue name here too, so the gate
  // holds even if a stop reached the day without going through classification.
  const tags = activity.interestTags?.length
    ? activity.interestTags
    : inferInterestTagsFromName(activity.location?.name ?? activity.title);
  return dayActivityCategories({
    name: activity.location?.name ?? activity.title,
    lat: activity.location?.lat ?? 0,
    lng: activity.location?.lng ?? 0,
    adultPrice: activity.activityCost ?? 0,
    intensity: activity.landmarkIntensity ?? "medium",
    ageTags: [],
    interestTags: tags,
    indoor: false,
    openingHours: { open: "00:00", close: "23:59" },
  } as Landmark);
}

/** HARD RULE: at most one activity per interest category on a given day. */
export function duplicateDayCategories(day: ItineraryDay): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const activity of categoryBearingStops(day)) {
    for (const category of categoriesForActivity(activity)) {
      const previous = seen.get(category);
      if (previous) {
        if (!duplicates.includes(category)) duplicates.push(category);
      } else {
        seen.set(category, activity.title);
      }
    }
  }
  return duplicates;
}

function labelFor(tag: LandmarkInterestTag, plan: TripPlan): string {
  return interestSourceLabels([tag], plan.interests)[0] ?? tag;
}

function locatedStops(day: ItineraryDay): ItineraryActivity[] {
  return day.activities.filter((a) => a.type !== "travel" && a.location);
}

function neighbours(
  stops: ItineraryActivity[],
  index: number,
): { from: ItineraryActivity | null; to: ItineraryActivity | null } {
  let from: ItineraryActivity | null = null;
  for (let i = index - 1; i >= 0; i--) {
    if (stops[i]!.type === "activity") {
      from = stops[i]!;
      break;
    }
  }
  let to: ItineraryActivity | null = null;
  for (let i = index + 1; i < stops.length; i++) {
    if (stops[i]!.type === "activity") {
      to = stops[i]!;
      break;
    }
  }
  return { from, to };
}

/** Extra distance each restaurant adds to the day's flow. */
export function mealDetoursForDay(day: ItineraryDay): Array<{ title: string; km: number }> {
  const stops = locatedStops(day);
  const out: Array<{ title: string; km: number }> = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]!;
    if (stop.type !== "meal") continue;
    const { from, to } = neighbours(stops, i);
    if (!from && !to) continue;
    const meal = stop.location!;
    if (from && to) {
      const via =
        haversineKm(from.location!.lat, from.location!.lng, meal.lat, meal.lng) +
        haversineKm(meal.lat, meal.lng, to.location!.lat, to.location!.lng);
      const direct = haversineKm(
        from.location!.lat,
        from.location!.lng,
        to.location!.lat,
        to.location!.lng,
      );
      out.push({ title: stop.title, km: Math.max(0, via - direct) });
      continue;
    }
    const anchor = (from ?? to)!.location!;
    out.push({
      title: stop.title,
      km: haversineKm(anchor.lat, anchor.lng, meal.lat, meal.lng),
    });
  }
  return out;
}

const KM_IN_TEXT = /\b\d+(\.\d+)?\s?(km|kilometer|kilometre)s?\b/i;

/**
 * Final gate before the itinerary is returned. Everything here is a rule the
 * planner is supposed to have already enforced during generation — a violation
 * means a selection stage let something through.
 */
export function validateItinerary(
  days: ItineraryDay[],
  plan: TripPlan,
  city: CityConfig,
): ItineraryViolation[] {
  const out: ItineraryViolation[] = [];
  const selected = new Set(interestTagsFromPlan(plan.interests));
  const covered = new Set<LandmarkInterestTag>();
  const detourLimit = mealDetourLimits(plan).maxKm;
  const seenVenues = new Map<string, number>();

  for (const day of days) {
    for (const category of duplicateDayCategories(day)) {
      out.push({
        code: "duplicate_day_category",
        day: day.day,
        message: `Day ${day.day} repeats the ${labelFor(category as LandmarkInterestTag, plan)} category.`,
      });
    }

    for (const activity of scheduledAttractions(day)) {
      const tags = activity.interestTags ?? [];
      for (const tag of tags) {
        if (selected.has(tag)) covered.add(tag);
      }
      if (selected.size > 0 && !tags.some((t) => selected.has(t))) {
        out.push({
          code: "unselected_category_filler",
          day: day.day,
          message: `Day ${day.day} "${activity.title}" is not in any selected interest.`,
        });
      }
      const venue = (activity.location?.name ?? activity.title).trim().toLowerCase();
      if (venue) {
        const prior = seenVenues.get(venue);
        if (prior != null) {
          out.push({
            code: "activity_reused",
            day: day.day,
            message: `"${activity.location?.name ?? activity.title}" appears on day ${prior} and day ${day.day}.`,
          });
        } else {
          seenVenues.set(venue, day.day);
        }
      }
    }

    for (const detour of mealDetoursForDay(day)) {
      if (detour.km > detourLimit) {
        out.push({
          code: "restaurant_detour",
          day: day.day,
          message: `Day ${day.day} "${detour.title}" adds ${detour.km.toFixed(1)} km of backtracking (max ${detourLimit}).`,
        });
      }
    }

    for (const activity of day.activities) {
      if (activity.notes && KM_IN_TEXT.test(activity.notes)) {
        out.push({
          code: "distance_not_in_miles",
          day: day.day,
          message: `Day ${day.day} "${activity.title}" shows a distance in kilometers.`,
        });
      }
      if (activity.type === "meal") {
        const expected = estimateMealPartyCostForActivity(activity, city, plan).total;
        if (Math.abs((activity.activityCost ?? 0) - expected) > 0.01) {
          out.push({
            code: "meal_cost_mismatch",
            day: day.day,
            message: `Day ${day.day} "${activity.title}" costs ${activity.activityCost} but the party model says ${expected}.`,
          });
        }
      }
    }

    if (plan.transportationType === "car-rental") {
      for (const segment of day.routeSegments) {
        if (segment.distanceKm <= 0) continue;
        const expected = estimateDrivingLegCost(city, segment.distanceKm, {
          parkAtDestination: (segment.parkingCost ?? 0) > 0,
        });
        if (Math.abs(segment.cost - expected.total) > 0.01) {
          out.push({
            code: "transport_cost_mismatch",
            day: day.day,
            message: `Day ${day.day} leg to ${segment.to} costs ${segment.cost}, not fuel ${expected.fuel} + parking ${expected.parking}.`,
          });
        }
      }
    }
  }

  // Coverage is per wizard choice: "Playgrounds & Indoor Play" is satisfied by
  // either a playground or an indoor-play stop, not both.
  for (const label of plan.interests) {
    const tags = INTEREST_LABEL_TO_TAGS[label] ?? [];
    if (tags.length > 0 && !tags.some((tag) => covered.has(tag))) {
      out.push({
        code: "uncovered_selected_interest",
        message: `${label} was selected but never scheduled.`,
      });
    }
  }

  return out;
}

function activityAsLandmark(activity: ItineraryActivity): Landmark {
  return {
    name: activity.location?.name ?? activity.title,
    lat: activity.location?.lat ?? 0,
    lng: activity.location?.lng ?? 0,
    adultPrice: 0,
    intensity: activity.landmarkIntensity ?? "medium",
    ageTags: [],
    interestTags: activity.interestTags ?? [],
    indoor: false,
    openingHours: { open: "00:00", close: "23:59" },
  };
}

/**
 * Last line of defence for the one-category-per-day rule: swap a repeated
 * category for a genuinely different activity, preferring a selected interest
 * the trip hasn't covered yet. If nothing clean is available the stop is
 * dropped rather than left as a second helping of the same thing.
 *
 * Runs while the day is being enriched, before routes and costs are priced, so
 * a swapped stop is routed and costed like any other.
 */
export function repairDuplicateCategories(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
  ctx: { usedNames: Set<string>; preferTags?: LandmarkInterestTag[] } = {
    usedNames: new Set(),
  },
): ItineraryActivity[] {
  const selected = new Set(interestTagsFromPlan(plan.interests));
  const takenCategories = new Set<string>();
  const dayStops: Landmark[] = [];
  const out: ItineraryActivity[] = [];

  for (const raw of activities) {
    // Classify first: a stop that arrived without catalog tags must still hold a
    // category, otherwise it could sit next to a twin of itself unnoticed.
    const tags = isCategorizableActivity(raw)
      ? classifyActivityInterestTags(raw, city)
      : (raw.interestTags ?? []);
    const activity = tags.length > 0 ? { ...raw, interestTags: tags } : raw;

    if (!isCategorizableActivity(activity) || tags.length === 0) {
      out.push(activity);
      continue;
    }

    const categories = [...categoriesForActivity(activity)];
    if (!categories.some((c) => takenCategories.has(c))) {
      for (const c of categories) takenCategories.add(c);
      dayStops.push(activityAsLandmark(activity));
      if (activity.location?.name) ctx.usedNames.add(activity.location.name);
      out.push(activity);
      continue;
    }

    const replacement = findReplacementLandmark(city, plan, {
      takenCategories,
      usedNames: ctx.usedNames,
      dayStops,
      preferTags: ctx.preferTags ?? [...selected],
    });
    if (!replacement) continue; // drop rather than repeat the category

    ctx.usedNames.add(replacement.name);
    for (const c of dayActivityCategories(replacement)) takenCategories.add(c);
    dayStops.push(replacement);
    out.push({
      ...activity,
      title: suggestActivityTitle(
        replacement.name,
        plan,
        activity.timeOfDay === "morning" ? "morning" : "afternoon",
        replacement.interestTags,
      ),
      location: { name: replacement.name, lat: replacement.lat, lng: replacement.lng },
      placeId: replacement.placeId,
      rating: replacement.rating,
      reviewCount: replacement.reviewCount,
      interestTags: replacement.interestTags,
      landmarkIntensity: replacement.intensity,
      activityCost: familyActivityCost(replacement, plan.adults, plan.children),
    });
  }

  return out;
}

/** Trip-wide view of repairDuplicateCategories — prefers still-uncovered interests. */
export function enforceDayCategoryUniqueness(
  days: ItineraryDay[],
  plan: TripPlan,
  city: CityConfig,
): ItineraryDay[] {
  const selected = new Set(interestTagsFromPlan(plan.interests));
  const usedNames = new Set<string>();
  for (const day of days) {
    for (const a of scheduledAttractions(day)) {
      if (a.location?.name) usedNames.add(a.location.name);
    }
  }
  const covered = new Set<LandmarkInterestTag>();

  return days.map((day) => {
    const needsRepair = duplicateDayCategories(day).length > 0;
    const activities = needsRepair
      ? repairDuplicateCategories(day.activities, plan, city, {
          usedNames,
          preferTags: [...selected].filter((t) => !covered.has(t)),
        })
      : day.activities;

    for (const a of activities) {
      for (const t of a.interestTags ?? []) if (selected.has(t)) covered.add(t);
    }
    return needsRepair ? { ...day, activities } : day;
  });
}

function findReplacementLandmark(
  city: CityConfig,
  plan: TripPlan,
  ctx: {
    takenCategories: Set<string>;
    usedNames: Set<string>;
    dayStops: Landmark[];
    preferTags: LandmarkInterestTag[];
  },
): Landmark | null {
  const prefer = new Set(ctx.preferTags);
  const selected = new Set(interestTagsFromPlan(plan.interests));
  const centre = ctx.dayStops[ctx.dayStops.length - 1] ?? null;

  const candidates = city.landmarks.filter((l) => {
    if (ctx.usedNames.has(l.name)) return false;
    if (l.interestTags.length === 0) return false;
    if (selected.size > 0 && !l.interestTags.some((t) => selected.has(t))) return false;
    for (const c of dayActivityCategories(l)) {
      if (ctx.takenCategories.has(c)) return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;

  const score = (l: Landmark) => {
    const uncoveredHit = l.interestTags.some((t) => prefer.has(t)) ? 60 : 0;
    const distance = centre
      ? haversineKm(centre.lat, centre.lng, l.lat, l.lng)
      : 0;
    return uncoveredHit - distance * 2;
  };
  return [...candidates].sort(
    (a, b) => score(b) - score(a) || a.name.localeCompare(b.name),
  )[0]!;
}
