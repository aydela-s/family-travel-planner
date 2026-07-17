import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  requiresBreakfastSlot,
  shouldCookDinnerAtHome,
} from "@/lib/planning-engine/meal-planner";
import { dinnerDefaultTime, lunchDefaultTime } from "@/lib/planning-engine/meal-timing";
import { priorityForSlotKind } from "@/lib/planning-engine/day-intent";
import { AdjustmentContext, intensityForDay } from "@/lib/planning-engine/day-adjustment";
import { DayIntent } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";

function intent(kind: DayIntent["kind"], defaultTime: string): DayIntent {
  return { kind, defaultTime, priority: priorityForSlotKind(kind) };
}

/** Morning activity start — 10:00 with breakfast out, 08:30 when eating at lodging. */
export function morningActivityDefaultTime(plan: TripPlan): string {
  return requiresBreakfastSlot(plan) ? "10:00" : "08:30";
}

function isRelaxedStyle(intensity: ReturnType<typeof intensityForDay>, adjustment?: AdjustmentContext): boolean {
  return intensity.style === "relaxed" || Boolean(adjustment?.relaxedDay);
}

function includeNapForDay(plan: TripPlan, adjustment?: AdjustmentContext): boolean {
  if (adjustment?.skipNap) return false;
  return shouldIncludeNaps(plan);
}

/**
 * P1 daily structure — deterministic skeleton by travel style.
 * Nap is inserted during schedule fix; not part of the skeleton list.
 */
export function buildDaySkeleton(
  plan: TripPlan,
  day: number,
  _totalDays: number,
  adjustment?: AdjustmentContext,
): DayIntent[] {
  const intensity = intensityForDay(plan, adjustment);
  const relaxed = isRelaxedStyle(intensity, adjustment);
  const slots: DayIntent[] = [];

  if (requiresBreakfastSlot(plan)) {
    slots.push(intent("breakfast", "08:00"));
  }

  slots.push(intent("morning_activity", morningActivityDefaultTime(plan)));
  slots.push(intent("lunch", lunchDefaultTime(plan)));

  if (!includeNapForDay(plan, adjustment)) {
    slots.push(intent("midday_rest", "13:30"));
  }

  if (intensity.restBlocks >= 2 && !relaxed) {
    slots.push(intent("afternoon_rest", "15:00"));
  }

  if (relaxed) {
    if (!adjustment?.removeActivity) {
      slots.push(intent("calm_activity", "15:30"));
    }
  } else if (intensity.includeAfternoonActivity) {
    slots.push(intent("afternoon_activity", "15:30"));
  }

  if (intensity.includeExtraActivity) {
    slots.push(intent("extra_activity", "16:15"));
  }

  if (shouldCookDinnerAtHome(plan, day, adjustment)) {
    slots.push(intent("grocery", "17:00"));
    slots.push(intent("dinner", dinnerDefaultTime(plan)));
  } else {
    slots.push(intent("dinner", dinnerDefaultTime(plan)));
  }

  return slots;
}

/** Alias for intent-based skeleton API. */
export const buildDayIntents = buildDaySkeleton;
