import { TripPlan } from "@/types/trip-plan";
import { ActivityType, ItineraryActivity, ItineraryDay, RawItinerary, TimeOfDay } from "@/types/itinerary";
import { getTimeOfDay } from "@/lib/format";
import { AdjustmentContext, getAdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import { adjustmentRevisionKey } from "@/lib/schedule/adjust-day";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import {
  anchorDinnerTimes,
  hasCookDinnerAtHome,
  resolveGroceryMealConflicts,
  rescheduleActivitiesWithMealAnchors,
  validateMealPlan,
} from "@/lib/schedule/meal-planning";
import {
  applyNapTiming,
  getNapWindow,
  hasChildren,
  napDurationMin,
  sanitizeActivitiesForNapPolicy,
  shouldIncludeNaps,
  wantsNoNaps,
} from "@/lib/schedule/nap-policy";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import {
  activitiesOverlap,
  defaultTravelMin,
  duplicateStartTimes,
  parseTimeToMinutes,
  rescheduleActivities,
} from "@/lib/schedule/timeline";

type RawActivity = RawItinerary["days"][0]["activities"][0];

export type ValidationIssue = {
  code: string;
  message: string;
};

function processRawActivities(
  activities: RawActivity[],
  plan: TripPlan,
  adjustment?: AdjustmentContext,
): RawActivity[] {
  let fixed = activities.filter((a) => a.type !== "nap");

  if (adjustment?.skipNap) {
    fixed = sanitizeActivitiesForNapPolicy(fixed, plan);
    if (!fixed.some((a) => a.type === "rest" && parseTimeToMinutes(a.time) < 15 * 60)) {
      const afterLunch = fixed.findIndex((a) => a.type === "meal" && parseTimeToMinutes(a.time) >= 12 * 60);
      const insertAt = afterLunch >= 0 ? afterLunch + 1 : fixed.length;
      fixed.splice(insertAt, 0, {
        time: "13:30",
        title: "Midday break",
        type: "rest",
        notes: "Nap skipped for this day per your adjustment.",
      });
    }
  } else {
    fixed = sanitizeActivitiesForNapPolicy(activities, plan);
    fixed = applyNapTiming(fixed, plan);
  }

  fixed = resolveGroceryMealConflicts(fixed, plan);

  let scheduled = rescheduleActivitiesWithMealAnchors(fixed, plan);
  scheduled = anchorDinnerTimes(scheduled);

  return scheduled.map(({ endTime: _e, ...rest }) => rest);
}

export function fixRawDayActivities(
  activities: RawActivity[],
  plan: TripPlan,
  adjustment?: AdjustmentContext,
): RawActivity[] {
  let result = processRawActivities(activities, plan, adjustment);
  const issues = validateRawDay(result, plan);

  if (issues.length > 0) {
    result = processRawActivities(result, plan, adjustment);
  }

  return result;
}

export function fixRawItinerary(
  raw: RawItinerary,
  plan: TripPlan,
  adjustDay?: number,
  adjustNote?: string,
): RawItinerary {
  return {
    days: raw.days.map((day) => ({
      ...day,
      activities: fixRawDayActivities(
        day.activities,
        plan,
        day.day === adjustDay && adjustNote
          ? getAdjustmentContext(adjustNote, day.day)
          : undefined,
      ),
    })),
  };
}

function travelGapsFromSegments(
  activities: ItineraryActivity[],
  segmentDurations: number[],
  plan: TripPlan,
): number[] {
  const gaps: number[] = [];
  let segIdx = 0;

  for (let i = 0; i < activities.length - 1; i++) {
    const from = activities[i].location;
    const to = activities[i + 1].location;
    if (from && to && segIdx < segmentDurations.length) {
      gaps.push(Math.max(segmentDurations[segIdx], 10));
      segIdx += 1;
    } else {
      gaps.push(defaultTravelMin(plan));
    }
  }

  return gaps;
}

function processEnrichedActivities(
  activities: ItineraryActivity[],
  plan: TripPlan,
  segmentDurations: number[] = [],
): ItineraryActivity[] {
  const raw = activities.map(({ time, title, type, notes }) => ({ time, title, type, notes }));
  let fixed = processRawActivities(raw, plan);
  const travelGaps = travelGapsFromSegments(
    fixed as ItineraryActivity[],
    segmentDurations,
    plan,
  );
  fixed = rescheduleActivitiesWithMealAnchors(fixed, plan, travelGaps);
  fixed = anchorDinnerTimes(fixed);

  return fixed.map((a) => ({
    ...(activities.find((o) => o.title === a.title && o.type === a.type) ?? {}),
    ...a,
    timeOfDay: getTimeOfDay(a.time) as TimeOfDay,
  })) as ItineraryActivity[];
}

export function scheduleEnrichedActivities(
  activities: ItineraryActivity[],
  plan: TripPlan,
  segmentDurations: number[] = [],
): ItineraryActivity[] {
  return processEnrichedActivities(activities, plan, segmentDurations);
}

export function validateRawDay(
  activities: RawActivity[],
  plan: TripPlan,
  adjustNote?: string,
  previousActivities?: RawActivity[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!shouldIncludeNaps(plan) && activities.some((a) => a.type === "nap")) {
    issues.push({ code: "nap_when_disabled", message: "Nap block present but naps are disabled" });
  }
  if (!hasChildren(plan) && activities.some((a) => a.type === "nap")) {
    issues.push({ code: "nap_without_children", message: "Nap present without children" });
  }

  if (shouldIncludeNaps(plan)) {
    const window = getNapWindow(plan);
    const nap = activities.find((a) => a.type === "nap");
    if (window && nap) {
      const start = parseTimeToMinutes(nap.time);
      const end = start + napDurationMin(plan);
      if (start < window.startMin - 5 || end > window.endMin + 5) {
        issues.push({ code: "nap_wrong_window", message: "Nap outside user preference window" });
      }
    }
  }

  if (duplicateStartTimes(activities)) {
    issues.push({ code: "duplicate_times", message: "Multiple activities share the same start time" });
  }

  const scheduled = rescheduleActivities(activities, plan);
  if (activitiesOverlap(scheduled)) {
    issues.push({ code: "overlap", message: "Activities overlap in the schedule" });
  }

  for (const msg of validateMealPlan(activities)) {
    issues.push({ code: "meal_conflict", message: msg });
  }

  const intensity = getIntensityConfig(plan);
  const activityCount = activities.filter((a) => a.type === "activity").length;
  if (plan.travelStyle === "relaxed" && activityCount > intensity.maxActivities + 1) {
    issues.push({ code: "intensity_relaxed", message: "Too many activities for relaxed pace" });
  }
  if (plan.travelStyle === "packed" && activityCount < 2 && !getFamilyAgeProfile(plan).youngest) {
    issues.push({ code: "intensity_packed", message: "Packed day has too few activities" });
  }

  if (adjustNote && previousActivities && adjustmentRevisionKey(previousActivities) === adjustmentRevisionKey(activities)) {
    issues.push({ code: "adjust_unchanged", message: "Adjusted day did not change after regeneration" });
  }

  return issues;
}

export function validateEnrichedDay(day: ItineraryDay, plan: TripPlan): ValidationIssue[] {
  return validateRawDay(
    day.activities.map(({ time, title, type, notes }) => ({ time, title, type, notes })),
    plan,
  );
}

export function prepareItineraryForEnrich(
  raw: RawItinerary,
  plan: TripPlan,
  adjustDay?: number,
  adjustNote?: string,
): RawItinerary {
  return fixRawItinerary(raw, plan, adjustDay, adjustNote);
}

export function finalizeEnrichedDay(day: ItineraryDay, plan: TripPlan): ItineraryDay {
  const segmentDurations = day.routeSegments.map((s) => s.durationMin);
  const rescheduled = scheduleEnrichedActivities(day.activities, plan, segmentDurations);
  return { ...day, activities: rescheduled };
}

export function mergeAdjustedEnrichedDay(
  previous: ItineraryDay[],
  updated: ItineraryDay[],
  adjustDay: number,
): ItineraryDay[] {
  const newDay = updated.find((d) => d.day === adjustDay);
  if (!newDay) return previous;
  return previous.map((d) => (d.day === adjustDay ? newDay : d));
}

export function mergeAdjustedRawDay(
  previous: RawItinerary,
  updated: RawItinerary,
  adjustDay: number,
): RawItinerary {
  const newDay = updated.days.find((d) => d.day === adjustDay);
  if (!newDay) return updated;

  return {
    days: previous.days.map((d) => (d.day === adjustDay ? newDay : d)),
  };
}
