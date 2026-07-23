import { dinnerTimeWindow, lunchTimeWindow } from "@/lib/planning-engine/meal-timing";
import {
  isDaytimeMeal,
  isDinnerMeal,
  isGroceryActivity,
  isLunchMeal,
  lunchFloorBeforeNap,
} from "@/lib/schedule/meal-planning";
import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  activitiesOverlap,
  defaultDurationMin,
  defaultTravelMin,
  duplicateStartTimes,
  minutesToTime,
  parseTimeToMinutes,
} from "@/lib/schedule/timeline";
import { ActivityType } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type ScheduleViolation = {
  code: string;
  message: string;
};

type Schedulable = {
  time: string;
  endTime?: string;
  title: string;
  type: ActivityType;
  notes?: string;
};

function withEndTimes(activities: Schedulable[], plan: TripPlan): Array<Schedulable & { endTime: string }> {
  return activities.map((a) => {
    if (a.endTime) return a as Schedulable & { endTime: string };
    const start = parseTimeToMinutes(a.time);
    const end = start + defaultDurationMin(a.type, plan);
    return { ...a, endTime: minutesToTime(end) };
  });
}

/** Central invariant checks for a fully scheduled day (with end times). */
export function validateDaySchedule(
  activities: Schedulable[],
  plan: TripPlan,
  options?: { expectedTitles?: string[] },
): ScheduleViolation[] {
  const issues: ScheduleViolation[] = [];
  const scheduled = withEndTimes(activities, plan);

  if (duplicateStartTimes(scheduled)) {
    issues.push({ code: "duplicate_times", message: "Multiple activities share the same start time" });
  }

  if (activitiesOverlap(scheduled)) {
    issues.push({ code: "overlap", message: "Activities overlap in the schedule" });
  }

  for (let i = 1; i < scheduled.length; i++) {
    const prevEnd = parseTimeToMinutes(scheduled[i - 1].endTime);
    const start = parseTimeToMinutes(scheduled[i].time);
    if (start < prevEnd) {
      issues.push({
        code: "time_travel",
        message: `${scheduled[i].title} starts before ${scheduled[i - 1].title} ends`,
      });
    }
  }

  const lunch = scheduled.find(isDaytimeMeal);
  if (lunch) {
    const { minMin, maxMin } = lunchTimeWindow(plan);
    const start = parseTimeToMinutes(lunch.time);
    const earliest = shouldIncludeNaps(plan) ? lunchFloorBeforeNap(plan) : minMin;
    if (start < earliest || start > maxMin) {
      issues.push({
        code: "lunch_outside_window",
        message: `Lunch at ${lunch.time} outside allowed window`,
      });
    }
  }

  const dinner = scheduled.find(isDinnerMeal);
  if (dinner) {
    const { minMin, maxMin } = dinnerTimeWindow(plan);
    const start = parseTimeToMinutes(dinner.time);
    const end = parseTimeToMinutes(dinner.endTime);
    if (start < minMin) {
      issues.push({ code: "dinner_too_early", message: `Dinner at ${dinner.time} is before ${minMin}` });
    }
    if (end > maxMin) {
      issues.push({ code: "dinner_too_late", message: `Dinner ends after allowed window` });
    }

    const lastNonDinner = [...scheduled].filter((a) => !isDinnerMeal(a)).pop();
    if (lastNonDinner && parseTimeToMinutes(dinner.time) < parseTimeToMinutes(lastNonDinner.endTime)) {
      issues.push({
        code: "dinner_before_activity",
        message: "Dinner starts before the previous item ends",
      });
    }
  }

  const groceryIdx = scheduled.findIndex(isGroceryActivity);
  const dinnerIdx = scheduled.findIndex(isDinnerMeal);
  if (groceryIdx >= 0 && dinnerIdx >= 0 && groceryIdx > dinnerIdx) {
    issues.push({ code: "grocery_after_dinner", message: "Grocery stop is scheduled after dinner" });
  }

  if (options?.expectedTitles) {
    for (const title of options.expectedTitles) {
      if (!scheduled.some((a) => a.title === title)) {
        issues.push({ code: "missing_item", message: `Expected activity missing from schedule: ${title}` });
      }
    }
  }

  const lunchIdx = scheduled.findIndex(isLunchMeal);
  if (lunchIdx >= 0 && lunchIdx < scheduled.length - 1) {
    const lunchEnd = parseTimeToMinutes(scheduled[lunchIdx].endTime);
    const nextStart = parseTimeToMinutes(scheduled[lunchIdx + 1].time);
    const gap = nextStart - lunchEnd;
    if (gap > 180) {
      issues.push({
        code: "lunch_gap",
        message: `Large gap (${gap} min) between lunch and next item`,
      });
    }
  }

  return issues;
}

export function assertDaySchedule(
  activities: Schedulable[],
  plan: TripPlan,
  options?: { expectedTitles?: string[] },
): void {
  const issues = validateDaySchedule(activities, plan, options);
  if (issues.length > 0) {
    throw new Error(issues.map((i) => i.message).join("; "));
  }
}
