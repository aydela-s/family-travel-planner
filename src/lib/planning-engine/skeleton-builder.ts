import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  requiresBreakfastSlot,
  shouldCookDinnerAtHome,
} from "@/lib/planning-engine/meal-planner";
import { AdjustmentContext, intensityForDay } from "@/lib/planning-engine/day-adjustment";
import { SkeletonSlot } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";

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
): SkeletonSlot[] {
  const intensity = intensityForDay(plan, adjustment);
  const slots: SkeletonSlot[] = [];

  if (requiresBreakfastSlot(plan)) {
    slots.push({ kind: "breakfast", defaultTime: "08:30" });
  }

  slots.push({ kind: "morning_activity", defaultTime: "10:00" });
  slots.push({ kind: "lunch", defaultTime: "12:30" });

  if (!includeNapForDay(plan, adjustment)) {
    slots.push({ kind: "midday_rest", defaultTime: "13:30" });
  }

  if (intensity.restBlocks >= 2) {
    slots.push({ kind: "afternoon_rest", defaultTime: "15:00" });
  }

  if (intensity.style === "relaxed" || adjustment?.relaxedDay) {
    if (!adjustment?.removeActivity) {
      slots.push({ kind: "calm_activity", defaultTime: "15:30" });
    }
  } else if (intensity.includeAfternoonActivity) {
    slots.push({ kind: "afternoon_activity", defaultTime: "15:30" });
  }

  if (intensity.includeExtraActivity) {
    slots.push({ kind: "extra_activity", defaultTime: "16:15" });
  }

  if (shouldCookDinnerAtHome(plan, day, adjustment)) {
    slots.push({ kind: "grocery", defaultTime: "17:00" });
    slots.push({ kind: "dinner", defaultTime: "18:45" });
  } else {
    if (!intensity.longBreak) {
      slots.push({ kind: "evening_rest", defaultTime: "17:15" });
    }
    slots.push({ kind: "dinner", defaultTime: "18:45" });
  }

  return slots;
}
