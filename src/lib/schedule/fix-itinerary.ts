import { TripPlan } from "@/types/trip-plan";
import { ActivityType, ItineraryActivity, ItineraryDay, RawItinerary, TimeOfDay } from "@/types/itinerary";
import { getTimeOfDay } from "@/lib/format";
import { AdjustmentContext, getAdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import { DayLandmarkContext } from "@/lib/planning-engine/types";
import { adjustmentRevisionKey } from "@/lib/schedule/adjust-day";
import {
  applyTravelThreshold,
  estimateTravelGapsForDay,
  estimateTravelMinBetween,
} from "@/lib/schedule/estimate-travel";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import {
  anchorDinnerTimes,
  hasCookDinnerAtHome,
  NAP_START_SLIP_MAX_MIN,
  resolveGroceryMealConflicts,
  rescheduleActivitiesWithMealAnchors,
  validateMealPlan,
} from "@/lib/schedule/meal-planning";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import {
  applyNapTiming,
  getRegularNapWindows,
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
  landmarkCtx?: DayLandmarkContext,
  day: number = 1,
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
        type: "activity",
        notes: "Nap skipped for this day per your adjustment.",
      });
    }
  } else {
    fixed = sanitizeActivitiesForNapPolicy(activities, plan);
    fixed = applyNapTiming(fixed, plan);
  }

  fixed = resolveGroceryMealConflicts(fixed, plan, day);

  const travelGaps = landmarkCtx ? estimateTravelGapsForDay(fixed, landmarkCtx, plan) : [];
  let scheduled = rescheduleActivitiesWithMealAnchors(fixed, plan, travelGaps);
  scheduled = anchorDinnerTimes(scheduled, plan);

  for (const v of validateDaySchedule(scheduled, plan)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[schedule] ${v.code}: ${v.message}`);
    }
  }

  // Keep endTime so nap-window validation and enrich can use the scheduled span.
  return scheduled;
}

export function fixRawDayActivities(
  activities: RawActivity[],
  plan: TripPlan,
  adjustment?: AdjustmentContext,
  landmarkCtx?: DayLandmarkContext,
  day: number = 1,
): RawActivity[] {
  let result = processRawActivities(activities, plan, adjustment, landmarkCtx, day);
  const issues = validateRawDay(result, plan);

  if (issues.length > 0) {
    result = processRawActivities(result, plan, adjustment, landmarkCtx, day);
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
        undefined,
        day.day,
      ),
    })),
  };
}

export function travelGapsFromSegments(
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
      const expected = estimateTravelMinBetween(from, to, plan);
      gaps.push(applyTravelThreshold(expected, segmentDurations[segIdx]));
      segIdx += 1;
    } else {
      gaps.push(defaultTravelMin(plan));
    }
  }

  return gaps;
}

function mergeEnrichedSchedule(
  scheduled: Array<RawActivity & { endTime?: string }>,
  enriched: ItineraryActivity[],
): ItineraryActivity[] {
  const pool = [...enriched];
  return scheduled.map((a) => {
    const idx = pool.findIndex((e) => e.title === a.title && e.type === a.type);
    const base = idx >= 0 ? pool.splice(idx, 1)[0] : ({} as ItineraryActivity);
    return {
      ...base,
      time: a.time,
      title: a.title,
      type: a.type,
      // Prefer rescheduled nap notes (actual downtime window) over typed preference copy.
      notes: a.type === "nap" ? (a.notes ?? base.notes) : (a.notes ?? base.notes),
      endTime: a.endTime,
      slotKind: a.slotKind ?? base.slotKind,
      landmarkIntensity: a.landmarkIntensity ?? base.landmarkIntensity,
      interestTags: a.interestTags ?? base.interestTags,
      timeOfDay: getTimeOfDay(a.time) as TimeOfDay,
    };
  });
}

/** Re-time an enriched day using real segment durations — does not re-run raw meal/nap fixes. */
export function rescheduleEnrichedActivities(
  activities: ItineraryActivity[],
  plan: TripPlan,
  segmentDurations: number[] = [],
): ItineraryActivity[] {
  const raw = activities.map((a) => ({
    time: a.time,
    title: a.title,
    type: a.type,
    notes: a.notes,
    ...(a.slotKind ? { slotKind: a.slotKind } : {}),
    ...(a.landmarkIntensity ? { landmarkIntensity: a.landmarkIntensity } : {}),
    ...(a.interestTags?.length ? { interestTags: a.interestTags } : {}),
  }));
  const travelGaps = travelGapsFromSegments(activities, segmentDurations, plan);

  let scheduled = rescheduleActivitiesWithMealAnchors(raw, plan, travelGaps);
  scheduled = anchorDinnerTimes(scheduled, plan);

  for (const v of validateDaySchedule(scheduled, plan)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[schedule:enrich] ${v.code}: ${v.message}`);
    }
  }

  return mergeEnrichedSchedule(scheduled, activities);
}

function processEnrichedActivities(
  activities: ItineraryActivity[],
  plan: TripPlan,
  segmentDurations: number[] = [],
): ItineraryActivity[] {
  return rescheduleEnrichedActivities(activities, plan, segmentDurations);
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
    const windows = getRegularNapWindows(plan);
    const naps = activities.filter((a) => a.type === "nap");
    naps.forEach((nap, idx) => {
      const window = windows[idx];
      if (!window) return;
      const start = parseTimeToMinutes(nap.time);
      // Prefer endTime from the scheduler when present (includes intentional lunch-fit slip).
      const end = nap.endTime
        ? parseTimeToMinutes(nap.endTime)
        : start + napDurationMin(plan, window);
      // Allow lunch-fit slip + a small hard-floor push after lunch without re-scheduling
      // the whole day (re-running used to drop packed extras → packed looked like balanced).
      const latestStart = window.startMin + NAP_START_SLIP_MAX_MIN + 20;
      const latestEnd = window.endMin + NAP_START_SLIP_MAX_MIN + 20;
      if (start < window.startMin - 5 || start > latestStart || end > latestEnd) {
        issues.push({ code: "nap_wrong_window", message: "Nap outside user preference window" });
      }
    });
  }

  if (duplicateStartTimes(activities)) {
    issues.push({ code: "duplicate_times", message: "Multiple activities share the same start time" });
  }

  const scheduled = rescheduleActivities(activities, plan);
  if (activitiesOverlap(scheduled)) {
    issues.push({ code: "overlap", message: "Activities overlap in the schedule" });
  }

  for (const msg of validateMealPlan(activities, plan)) {
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
  const issues = validateEnrichedDay(day, plan);
  const scheduleIssues = validateDaySchedule(day.activities, plan);
  if (issues.length === 0 && scheduleIssues.length === 0) {
    return day;
  }

  const segmentDurations = day.routeSegments.map((s) => s.durationMin);
  return {
    ...day,
    activities: rescheduleEnrichedActivities(day.activities, plan, segmentDurations),
  };
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
