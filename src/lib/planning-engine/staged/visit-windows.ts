import { addDays } from "@/lib/format";
import { dinnerTimeWindow, lunchTimeWindow } from "@/lib/planning-engine/meal-timing";
import { morningActivityDefaultTime } from "@/lib/planning-engine/skeleton-builder";
import { afternoonActivityDefaultTime } from "@/lib/schedule/family-rhythm";
import type { DayBlueprint, MealSlotKind } from "@/lib/planning-engine/staged/types";
import type { VisitWindow } from "@/lib/schedule/landmark-hours";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import type { TripPlan } from "@/types/trip-plan";

/**
 * Planned visit windows for a day's stops. Selection and repair share these so
 * the opening-hours hard filter cannot judge a candidate against one window and
 * then schedule it against another.
 */
export function visitWindowFromTime(
  startTime: string,
  durationMin: number,
  visitDate: string,
): VisitWindow {
  const startMin = parseTimeToMinutes(startTime);
  return { startMin, endMin: startMin + durationMin, visitDate };
}

export function dayVisitDate(plan: TripPlan, day: DayBlueprint): string {
  return day.date || addDays(plan.startDate, day.dayIndex - 1);
}

export function anchorVisitWindow(plan: TripPlan, day: DayBlueprint): VisitWindow {
  const activityMins = Math.max(
    day.capacity.activityDurationMin,
    day.constraints.some((c) => c.type === "require_half_day_window") ? 240 : 0,
  );
  const visitDate = dayVisitDate(plan, day);
  const halfDay = day.constraints.some((c) => c.type === "require_half_day_window");
  if (halfDay) {
    const start = afternoonActivityDefaultTime(plan);
    return visitWindowFromTime(start, Math.max(activityMins, 240), visitDate);
  }
  // Default hero window: post-nap afternoon (after recovery downtime) or late morning
  if (day.capacity.maxActivitiesPerDay <= 1 || day.role === "departure") {
    return visitWindowFromTime(morningActivityDefaultTime(plan), activityMins, visitDate);
  }
  const start = afternoonActivityDefaultTime(plan);
  return visitWindowFromTime(start, activityMins, visitDate);
}

export function supportVisitWindow(plan: TripPlan, day: DayBlueprint): VisitWindow {
  return visitWindowFromTime(
    morningActivityDefaultTime(plan),
    day.capacity.activityDurationMin,
    dayVisitDate(plan, day),
  );
}

/** Sitting-down time for a meal slot — used to skip restaurants known to be closed. */
export function mealVisitWindow(
  plan: TripPlan,
  day: DayBlueprint,
  slot: MealSlotKind,
): VisitWindow {
  const visitDate = dayVisitDate(plan, day);
  switch (slot) {
    case "breakfast":
      return visitWindowFromTime("08:00", 45, visitDate);
    case "lunch":
      return { ...windowFromMealTimes(lunchTimeWindow(plan).defaultMin, 60), visitDate };
    case "dinner":
      return { ...windowFromMealTimes(dinnerTimeWindow(plan).defaultMin, 75), visitDate };
  }
}

function windowFromMealTimes(startMin: number, durationMin: number) {
  return { startMin, endMin: startMin + durationMin };
}
