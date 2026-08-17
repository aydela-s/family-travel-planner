import { ActivityType } from "@/types/itinerary";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { napDurationMin } from "@/lib/schedule/nap-policy";
import { visitDurationForTags } from "@/lib/schedule/activity-load";
import { TripPlan } from "@/types/trip-plan";

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60;
  return h * 60 + m;
}

/** Snap clock times to friendly increments (FAM-12). */
export const TIME_SNAP_MINUTES = 15;

export function snapMinutes(
  totalMinutes: number,
  step: number = TIME_SNAP_MINUTES,
): number {
  if (step <= 1) return Math.round(totalMinutes);
  return Math.round(totalMinutes / step) * step;
}

/** Round later, never earlier — a 6-minute taxi at 12:00 displays as 12:00–12:15. */
export function snapMinutesUp(
  totalMinutes: number,
  step: number = TIME_SNAP_MINUTES,
): number {
  if (step <= 1) return Math.ceil(totalMinutes);
  return Math.ceil(totalMinutes / step) * step;
}

/** Format a clock time without snapping (use after start has already been snapped). */
export function formatClockMinutes(totalMinutes: number): string {
  const clamped = Math.max(6 * 60, Math.min(22 * 60, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function minutesToTime(totalMinutes: number): string {
  return formatClockMinutes(snapMinutes(totalMinutes));
}

/**
 * Snap the start to a friendly clock, then snap the end as well (FAM-12)
 * so spans never display odd minutes like 9:32.
 */
export function scheduleSpan(
  startMin: number,
  durationMin: number,
): { time: string; endTime: string } {
  const start = snapMinutes(startMin);
  const rawEnd = start + Math.max(0, durationMin);
  let end = snapMinutes(rawEnd);
  // Keep a usable span if rounding collapsed start/end onto the same tick.
  if (end <= start) {
    end = start + TIME_SNAP_MINUTES;
  }
  return {
    time: formatClockMinutes(start),
    endTime: formatClockMinutes(end),
  };
}

/**
 * Travel rows round the end *up* so a short ride never collapses to 12:00–12:00
 * and never shows :06 / :07.
 */
export function travelSpan(
  startMin: number,
  durationMin: number,
): { time: string; endTime: string } {
  const start = snapMinutes(startMin);
  const rawEnd = start + Math.max(1, durationMin);
  let end = snapMinutesUp(rawEnd);
  if (end <= start) end = start + TIME_SNAP_MINUTES;
  return {
    time: formatClockMinutes(start),
    endTime: formatClockMinutes(end),
  };
}

export const GROCERY_DURATION_MIN = 30;

/** Café / bakery breakfast before the first stop. Sit-down lunch and dinner use MEAL_DURATION_MIN. */
export const BREAKFAST_DURATION_MIN = 45;

/** Sit-down lunch and dinner. */
export const MEAL_DURATION_MIN = 60;

/** Dinner must stay a real meal — never shrink it to a 15-minute placeholder. */
export const MIN_DINNER_DURATION_MIN = 60;

/** Minimum gap after grocery before cook-at-home dinner (get back + unpack). */
export const GROCERY_TO_DINNER_BUFFER_MIN = 30;

/** Extra rest/nap minutes after a high-intensity activity. */
export const HIGH_INTENSITY_REST_BONUS_MIN = 15;

/** Extra minutes between stops when the oldest child is 6 or under. */
export const YOUNG_CHILD_TRAVEL_BUFFER_MIN = 8;

export function isGroceryTitle(title: string): boolean {
  return /\bgrocery\b/i.test(title);
}

/** Soft timeline fillers typed as activity for display — never paid attractions. */
export function isUnpaidTimelineActivity(item: {
  type?: string;
  title: string;
  slotKind?: string;
}): boolean {
  if (isGroceryTitle(item.title) || /\bpicnic supplies\b/i.test(item.title)) return true;
  if (
    item.slotKind === "evening_rest" ||
    item.slotKind === "midday_rest" ||
    item.slotKind === "afternoon_rest" ||
    item.slotKind === "calm_activity" ||
    item.slotKind === "return_home"
  ) {
    return true;
  }
  return /\b(stroll|break|free time|calm family|pack up|low-key exploring)\b/i.test(item.title);
}

export function itemDurationMin(
  item: {
    type: ActivityType;
    title: string;
    slotKind?: string;
    interestTags?: import("@/config/city-pricing").LandmarkInterestTag[];
  },
  plan: TripPlan,
): number {
  if (item.type === "meal") {
    if (item.slotKind === "breakfast" || /\bbreakfast\b/i.test(item.title)) {
      return BREAKFAST_DURATION_MIN;
    }
    return MEAL_DURATION_MIN;
  }
  if (item.type === "activity" && isUnpaidTimelineActivity(item)) {
    if (isGroceryTitle(item.title) || /\bpicnic supplies\b/i.test(item.title)) {
      return GROCERY_DURATION_MIN;
    }
    return defaultDurationMin("rest", plan);
  }
  if (item.type === "activity") {
    const tagged = visitDurationForTags(item.interestTags, {
      youngest: getFamilyAgeProfile(plan).youngest,
      title: item.title,
    });
    if (item.interestTags?.length) return tagged;
    if (/\b(indoor\s*play|soft\s*play|water\s*park|aquatic|swim|shopping)\b/i.test(item.title)) {
      return tagged;
    }
  }
  return defaultDurationMin(item.type, plan);
}

export function defaultDurationMin(type: ActivityType, plan: TripPlan): number {
  const intensity = getIntensityConfig(plan);
  switch (type) {
    case "meal":
      return MEAL_DURATION_MIN;
    case "activity":
      return intensity.activityDurationMin;
    case "nap":
      return napDurationMin(plan);
    case "rest":
      return intensity.restDurationMin;
    case "travel":
      return 25;
    default:
      return 60;
  }
}

export function defaultTravelMin(plan: TripPlan): number {
  let base: number;
  if (plan.transportationType === "walking") {
    base = plan.walkingLimit === "low" ? 18 : 12;
  } else if (plan.transportationType === "taxis" || plan.transportationType === "car-rental") {
    base = 15;
  } else {
    base = 20;
  }

  const oldest = getFamilyAgeProfile(plan).oldest;
  if (oldest !== null && oldest <= 6) {
    return base + YOUNG_CHILD_TRAVEL_BUFFER_MIN;
  }
  return base;
}

type Schedulable = {
  time: string;
  endTime?: string;
  type: ActivityType;
  title: string;
  notes?: string;
};

export function rescheduleActivities<T extends Schedulable>(
  activities: T[],
  plan: TripPlan,
  travelAfterEach: number[] = [],
  startCursor?: number,
): (T & { endTime: string })[] {
  if (activities.length === 0) return [];

  const sorted = [...activities].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time),
  );

  const result: (T & { endTime: string })[] = [];
  let cursor = startCursor ?? Math.max(parseTimeToMinutes(sorted[0].time), 8 * 60);

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (i > 0) {
      const travel = travelAfterEach[i - 1] ?? defaultTravelMin(plan);
      cursor += travel;
    } else if (startCursor === undefined && parseTimeToMinutes(item.time) > cursor) {
      // Honor skeleton spacing only for the first scheduling pass (morning).
      // When chaining after nap/lunch, keep items back-to-back instead of
      // jumping to skeleton times and leaving multi-hour gaps.
      cursor = parseTimeToMinutes(item.time);
    }

    const duration = itemDurationMin(item, plan);
    const start = snapMinutes(cursor);
    const end = start + duration;

    result.push({
      ...item,
      time: minutesToTime(start),
      endTime: minutesToTime(end),
    });

    cursor = snapMinutes(end);
  }

  return result;
}

export function activitiesOverlap(activities: { time: string; endTime?: string; type: ActivityType }[]): boolean {
  const slots = activities.map((a) => ({
    start: parseTimeToMinutes(a.time),
    end: a.endTime ? parseTimeToMinutes(a.endTime) : parseTimeToMinutes(a.time) + 60,
  }));

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slots[i].start === slots[j].start) return true;
      if (slots[i].start < slots[j].end && slots[j].start < slots[i].end) return true;
    }
  }
  return false;
}

export function duplicateStartTimes(activities: { time: string }[]): boolean {
  const seen = new Set<string>();
  for (const a of activities) {
    if (seen.has(a.time)) return true;
    seen.add(a.time);
  }
  return false;
}
