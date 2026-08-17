import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  requiresBreakfastSlot,
  shouldAddTripStartGrocery,
  shouldFoldLunchIntoDay1Grocery,
  shouldCookDinnerAtHome,
} from "@/lib/planning-engine/meal-planner";
import { dinnerDefaultTime, lunchDefaultTime } from "@/lib/planning-engine/meal-timing";
import { afternoonActivityDefaultTime } from "@/lib/schedule/family-rhythm";
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
  // Day-1 kitchen + nap-overlap: lunch rides with grocery / nap delivery — no early takeout stop.
  if (!shouldFoldLunchIntoDay1Grocery(plan, day)) {
    slots.push(intent("lunch", lunchDefaultTime(plan)));
  }

  // Packed days stay dense — skip the idle midday recharge between lunch and afternoon.
  // When there is an afternoon activity, a separate "Break at X" before "Family time at X"
  // is redundant — the time gap is enough.
  if (
    !includeNapForDay(plan, adjustment) &&
    intensity.style !== "packed" &&
    !intensity.includeAfternoonActivity
  ) {
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
    // Post-lunch start — schedule fills theme parks through to dinner.
    slots.push(intent("afternoon_activity", afternoonActivityDefaultTime(plan)));
  }

  if (intensity.includeExtraActivity) {
    slots.push(intent("extra_activity", "16:15"));
  }

  // No evening_rest / "quiet time" slot — leave a natural gap until dinner.
  // Users read 3–5pm empty as downtime without an explicit hotel break line.

  // Day-1 grocery on the way home — before dinner (scheduler pulls it before nap when present).
  if (shouldAddTripStartGrocery(plan, day)) {
    slots.push(intent("grocery", "17:00"));
  }

  slots.push(intent("dinner", dinnerDefaultTime(plan)));

  return slots;
}

/** Alias for intent-based skeleton API. */
export const buildDayIntents = buildDaySkeleton;
