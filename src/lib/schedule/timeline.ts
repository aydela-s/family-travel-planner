import { ActivityType } from "@/types/itinerary";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { napDurationMin } from "@/lib/schedule/nap-policy";
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

export function minutesToTime(totalMinutes: number): string {
  const snapped = snapMinutes(totalMinutes);
  const clamped = Math.max(6 * 60, Math.min(22 * 60, snapped));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export const GROCERY_DURATION_MIN = 30;

/** Extra rest/nap minutes after a high-intensity activity. */
export const HIGH_INTENSITY_REST_BONUS_MIN = 15;

/** Extra minutes between stops when the oldest child is 6 or under. */
export const YOUNG_CHILD_TRAVEL_BUFFER_MIN = 8;

export function isGroceryTitle(title: string): boolean {
  return /\bgrocery\b/i.test(title);
}

export function itemDurationMin(
  item: { type: ActivityType; title: string },
  plan: TripPlan,
): number {
  if (item.type === "activity" && (isGroceryTitle(item.title) || /\bpicnic supplies\b/i.test(item.title))) {
    return GROCERY_DURATION_MIN;
  }
  // FAM-14: strolls/breaks display as activity but keep rest-length timing.
  if (
    item.type === "activity" &&
    /\b(stroll|break|free time|calm family|pack up|low-key exploring)\b/i.test(item.title)
  ) {
    return defaultDurationMin("rest", plan);
  }
  return defaultDurationMin(item.type, plan);
}

export function defaultDurationMin(type: ActivityType, plan: TripPlan): number {
  const intensity = getIntensityConfig(plan);
  switch (type) {
    case "meal":
      return 60;
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
