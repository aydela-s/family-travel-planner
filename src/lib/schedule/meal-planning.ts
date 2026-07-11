import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";
import { getNapWindow, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  defaultDurationMin,
  defaultTravelMin,
  GROCERY_DURATION_MIN,
  itemDurationMin,
  minutesToTime,
  parseTimeToMinutes,
  rescheduleActivities,
} from "@/lib/schedule/timeline";

type RawActivity = {
  time: string;
  title: string;
  type: ActivityType;
  notes?: string;
};

const GROCERY = /\bgrocery\b/i;
const RESTAURANT = /\b(restaurant|sit-down|dinner in|lunch in|lunch at|café|cafe)\b/i;
const COOK_DINNER = /\bcook dinner|dinner at your rental|cook at your|cook at accommodation\b/i;
const PICNIC = /\bpicnic\b/i;
const RETURN_HOME = /\breturn to|back to (your )?(rental|accommodation|stay|hotel|home)\b/i;

export function isGroceryActivity(a: RawActivity): boolean {
  return GROCERY.test(a.title) || GROCERY.test(a.notes ?? "");
}

export function isDinnerMeal(a: RawActivity): boolean {
  if (a.type !== "meal") return false;
  const t = `${a.title} ${a.notes ?? ""}`.toLowerCase();
  return (
    COOK_DINNER.test(t) ||
    t.includes("dinner") ||
    parseTimeToMinutes(a.time) >= 17 * 60
  );
}

export function isLunchMeal(a: RawActivity): boolean {
  if (a.type !== "meal") return false;
  const hour = parseTimeToMinutes(a.time);
  return hour >= 11 * 60 && hour < 16 * 60;
}

export function hasCookDinnerAtHome(activities: RawActivity[]): boolean {
  return activities.some((a) => a.type === "meal" && COOK_DINNER.test(`${a.title} ${a.notes ?? ""}`));
}

export function resolveGroceryMealConflicts(activities: RawActivity[], plan: TripPlan): RawActivity[] {
  let result = [...activities];
  const cookingDinner = hasCookDinnerAtHome(result);

  if (cookingDinner) {
    result = result.filter((a, i) => {
      if (!isGroceryActivity(a)) return true;
      const hour = parseTimeToMinutes(a.time);
      return hour >= 15 * 60;
    });

    if (!result.some(isGroceryActivity)) {
      const dinnerIdx = result.findIndex((a) => isDinnerMeal(a));
      const returnIdx = result.findIndex(
        (a, i) =>
          i < (dinnerIdx >= 0 ? dinnerIdx : result.length) &&
          (RETURN_HOME.test(a.title) || a.title.toLowerCase().includes("return")),
      );
      const insertAt =
        returnIdx >= 0 ? returnIdx : dinnerIdx >= 0 ? dinnerIdx : result.length - 1;

      result.splice(insertAt, 0, {
        time: "17:00",
        title: "Grocery stop for dinner ingredients",
        type: "activity",
        notes: "Pick up ingredients before heading back to cook dinner.",
      });
    }
  } else {
    for (let i = 0; i < result.length - 1; i++) {
      if (!isGroceryActivity(result[i])) continue;
      const nextMeal = result.slice(i + 1).find((a) => a.type === "meal");
      if (
        nextMeal &&
        isLunchMeal(nextMeal) &&
        RESTAURANT.test(`${nextMeal.title} ${nextMeal.notes ?? ""}`) &&
        !PICNIC.test(`${nextMeal.title} ${nextMeal.notes ?? ""}`)
      ) {
        result.splice(i, 1);
        i -= 1;
      }
    }
  }

  if (plan.accommodationType === "airbnb_with_kitchen" && !cookingDinner) {
    result = result.filter((a) => !isGroceryActivity(a) || parseTimeToMinutes(a.time) < 14 * 60);
  }

  return result;
}

/** Anchor family dinner between 5:00 PM and 8:00 PM */
export function anchorDinnerTimes<T extends RawActivity & { endTime?: string }>(
  activities: T[],
): T[] {
  const dinnerMin = 17 * 60;
  const dinnerMax = 20 * 60;
  const defaultDinner = 18 * 60 + 30;

  return activities.map((a) => {
    if (!isDinnerMeal(a)) return a;
    const start = parseTimeToMinutes(a.time);
    if (start >= dinnerMin && start <= dinnerMax) return a;

    const anchored = Math.max(dinnerMin, Math.min(defaultDinner, dinnerMax));
    return {
      ...a,
      time: minutesToTime(anchored),
      endTime: minutesToTime(anchored + 60),
    };
  });
}

export function validateMealPlan(activities: RawActivity[]): string[] {
  const issues: string[] = [];

  for (const a of activities) {
    if (isDinnerMeal(a)) {
      const start = parseTimeToMinutes(a.time);
      if (start < 17 * 60) {
        issues.push(`Dinner scheduled too early (${a.time})`);
      }
    }
  }

  if (hasCookDinnerAtHome(activities)) {
    const groceryIdx = activities.findIndex(isGroceryActivity);
    const dinnerIdx = activities.findIndex(isDinnerMeal);
    if (groceryIdx >= 0 && dinnerIdx >= 0 && groceryIdx > dinnerIdx) {
      issues.push("Grocery stop scheduled after cook-dinner");
    }
    const lunchIdx = activities.findIndex(isLunchMeal);
    if (
      groceryIdx >= 0 &&
      lunchIdx >= 0 &&
      groceryIdx < lunchIdx &&
      activities.some(
        (a, i) =>
          i > groceryIdx &&
          i < lunchIdx &&
          a.type === "meal" &&
          RESTAURANT.test(`${a.title} ${a.notes ?? ""}`),
      )
    ) {
      issues.push("Grocery stop conflicts with restaurant lunch");
    }
  }

  return issues;
}

/** Schedule day items, anchor nap to user window, grocery + dinner to evening */
export function rescheduleActivitiesWithMealAnchors<T extends RawActivity & { endTime?: string }>(
  activities: T[],
  plan: TripPlan,
  travelAfterEach: number[] = [],
): (T & { endTime: string })[] {
  const withoutReturnHome = activities.filter(
    (a) => !RETURN_HOME.test(a.title) && !/\breturn to your rental\b/i.test(a.title),
  );

  const dinnerItems = withoutReturnHome.filter(isDinnerMeal);
  const napItems = withoutReturnHome.filter((a) => a.type === "nap");
  const groceryItems = withoutReturnHome.filter(isGroceryActivity);
  const coreItems = withoutReturnHome.filter(
    (a) => !isDinnerMeal(a) && a.type !== "nap" && !isGroceryActivity(a),
  );

  const napWindow = shouldIncludeNaps(plan) ? getNapWindow(plan) : null;
  const napStart = napWindow?.startMin ?? 13 * 60;
  const napEnd = napWindow?.endMin ?? 15 * 60;

  const beforeNap = coreItems.filter((a) => parseTimeToMinutes(a.time) < napStart);
  const afterNap = coreItems.filter((a) => parseTimeToMinutes(a.time) >= napEnd);

  const morning = rescheduleActivities(beforeNap, plan, travelAfterEach.slice(0, Math.max(0, beforeNap.length - 1)));
  const result: (T & { endTime: string })[] = [...morning];

  let cursor =
    morning.length > 0
      ? parseTimeToMinutes(morning[morning.length - 1].endTime!)
      : 8 * 60;

  if (napItems.length > 0 && napWindow) {
    result.push({
      ...napItems[0],
      time: minutesToTime(napWindow.startMin),
      endTime: minutesToTime(napWindow.endMin),
    });
    cursor = napWindow.endMin + defaultTravelMin(plan);
  }

  if (afterNap.length > 0) {
    const afternoon = rescheduleActivities(afterNap, plan, [], cursor);
    result.push(...afternoon);
    cursor = parseTimeToMinutes(afternoon[afternoon.length - 1].endTime!) + defaultTravelMin(plan);
  }

  let dinnerStart = Math.max(17 * 60, cursor);

  if (groceryItems.length > 0) {
    const travel = defaultTravelMin(plan);
    const minDinner = 17 * 60;
    let groceryStart = cursor + travel;
    const latestGroceryStart = minDinner - GROCERY_DURATION_MIN - travel;
    if (groceryStart > latestGroceryStart) {
      groceryStart = Math.max(cursor + travel, latestGroceryStart);
    }

    result.push({
      ...groceryItems[0],
      time: minutesToTime(groceryStart),
      endTime: minutesToTime(groceryStart + GROCERY_DURATION_MIN),
    });
    dinnerStart = Math.max(minDinner, groceryStart + GROCERY_DURATION_MIN + travel);
  }

  dinnerStart = Math.min(Math.max(dinnerStart, 17 * 60), 20 * 60 - 60);

  const anchoredDinners = dinnerItems.map((d) => ({
    ...d,
    time: minutesToTime(dinnerStart),
    endTime: minutesToTime(dinnerStart + defaultDurationMin("meal", plan)),
  }));

  return [...result, ...anchoredDinners];
}
