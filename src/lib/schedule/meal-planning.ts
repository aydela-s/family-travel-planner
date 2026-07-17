import { LandmarkIntensity } from "@/config/city-pricing";
import { isOptionalActivity } from "@/lib/planning-engine/day-intent";
import {
  dinnerTimeWindow,
  lunchTimeWindow,
} from "@/lib/planning-engine/meal-timing";
import { SlotKind } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";
import { getNapWindow, napDurationMin, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  defaultDurationMin,
  defaultTravelMin,
  GROCERY_DURATION_MIN,
  HIGH_INTENSITY_REST_BONUS_MIN,
  itemDurationMin,
  minutesToTime,
  parseTimeToMinutes,
} from "@/lib/schedule/timeline";

type RawActivity = {
  time: string;
  title: string;
  type: ActivityType;
  notes?: string;
  slotKind?: SlotKind;
  landmarkIntensity?: LandmarkIntensity;
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
  if (isDinnerMeal(a)) return false;
  const hour = parseTimeToMinutes(a.time);
  return hour >= 11 * 60 && hour < 16 * 60;
}

/** Lunch slot in the day skeleton — not breakfast or dinner. */
export function isDaytimeMeal(a: RawActivity): boolean {
  if (a.type !== "meal" || isDinnerMeal(a)) return false;
  const t = `${a.title} ${a.notes ?? ""}`.toLowerCase();
  return !t.includes("breakfast");
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
        slotKind: "grocery",
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

/** Forward-only safety net — never move dinner earlier than already scheduled. */
export function anchorDinnerTimes<T extends RawActivity & { endTime?: string }>(
  activities: T[],
  plan: TripPlan,
): T[] {
  const { minMin, maxMin } = dinnerTimeWindow(plan);
  const dinnerDuration = defaultDurationMin("meal", plan);
  const latestStart = maxMin - dinnerDuration;

  return activities.map((a) => {
    if (!isDinnerMeal(a)) return a;
    const start = parseTimeToMinutes(a.time);
    if (start >= minMin && start <= latestStart) return a;

    const anchored = start < minMin ? minMin : latestStart;
    return {
      ...a,
      time: minutesToTime(anchored),
      endTime: minutesToTime(anchored + dinnerDuration),
    };
  });
}

export function validateMealPlan(activities: RawActivity[], plan: TripPlan): string[] {
  const issues: string[] = [];
  const { minMin } = dinnerTimeWindow(plan);

  for (const a of activities) {
    if (isDinnerMeal(a)) {
      const start = parseTimeToMinutes(a.time);
      if (start < minMin) {
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

function dinnerStartFromCursor(
  cursor: number,
  plan: TripPlan,
  hasGrocery: boolean,
  minMin: number,
): number {
  let dinnerStart = Math.max(minMin, cursor);

  if (hasGrocery) {
    const travel = defaultTravelMin(plan);
    let groceryStart = cursor + travel;
    const latestGroceryStart = minMin - GROCERY_DURATION_MIN - travel;
    if (groceryStart > latestGroceryStart) {
      groceryStart = Math.max(cursor + travel, latestGroceryStart);
    }
    dinnerStart = Math.max(minMin, groceryStart + GROCERY_DURATION_MIN + travel);
  }

  return dinnerStart;
}

function scheduleOne<T extends RawActivity>(
  item: T,
  start: number,
  plan: TripPlan,
): T & { endTime: string } {
  const duration = itemDurationMin(item, plan);
  return {
    ...item,
    time: minutesToTime(start),
    endTime: minutesToTime(start + duration),
  };
}

/**
 * Linear day scheduler — walks activities in list order (no nap-bucket drops).
 * Dinner and grocery are anchored to the evening; optional intents may be skipped.
 */
export function rescheduleActivitiesWithMealAnchors<T extends RawActivity & { endTime?: string }>(
  activities: T[],
  plan: TripPlan,
  travelAfterEach: number[] = [],
): (T & { endTime: string })[] {
  const ordered = activities.filter(
    (a) => !RETURN_HOME.test(a.title) && !/\breturn to your rental\b/i.test(a.title),
  );

  const dinnerItems = ordered.filter(isDinnerMeal);
  const groceryItems = ordered.filter(isGroceryActivity);
  const daySequence = ordered.filter((a) => !isDinnerMeal(a) && !isGroceryActivity(a));

  const required = daySequence.filter((a) => !isOptionalActivity(a));
  const optional = daySequence.filter(isOptionalActivity);

  const napWindow = shouldIncludeNaps(plan) ? getNapWindow(plan) : null;
  const { minMin: dinnerMin, maxMin: dinnerMax } = dinnerTimeWindow(plan);
  const dinnerDuration = defaultDurationMin("meal", plan);
  const latestDinnerStart = dinnerMax - dinnerDuration;
  const hasGrocery = groceryItems.length > 0;

  const result: (T & { endTime: string })[] = [];
  let cursor = 8 * 60;
  let travelIdx = 0;
  let needsRecoveryRest = false;

  const nextTravel = () => travelAfterEach[travelIdx++] ?? defaultTravelMin(plan);

  for (let i = 0; i < required.length; i++) {
    const item = required[i];
    const travel = result.length > 0 ? nextTravel() : 0;
    const lunchIdx = required.findIndex((a, j) => j > i && isDaytimeMeal(a));
    let start: number;

    if (item.type === "nap" && napWindow) {
      start = Math.min(
        Math.max(napWindow.startMin, cursor + travel),
        napWindow.startMin + 30,
      );
    } else if (isDaytimeMeal(item)) {
      const { maxMin: lunchMax, minMin } = lunchTimeWindow(plan);
      const natural = cursor + travel;
      start = Math.min(Math.max(natural, minMin), lunchMax);
      if (start < natural) {
        start = natural;
      }
    } else if (result.length === 0) {
      start = Math.max(cursor, parseTimeToMinutes(item.time));
    } else {
      start = cursor + travel;
    }

    let duration = itemDurationMin(item, plan);
    if (needsRecoveryRest && (item.type === "rest" || item.type === "nap")) {
      duration += HIGH_INTENSITY_REST_BONUS_MIN;
      needsRecoveryRest = false;
    }
    if (lunchIdx > i) {
      const { maxMin: lunchMax } = lunchTimeWindow(plan);
      const gap = defaultTravelMin(plan);
      let budget = lunchMax - gap;
      for (let k = lunchIdx - 1; k > i; k--) {
        budget -= gap + 20;
      }
      const maxEnd = budget;
      if (start >= maxEnd) {
        start = Math.max(cursor + (result.length > 0 ? gap : 0), maxEnd - 20);
      }
      duration = Math.min(duration, Math.max(20, maxEnd - start));
    }

    const scheduled = {
      ...item,
      time: minutesToTime(start),
      endTime: minutesToTime(start + duration),
    };
    result.push(scheduled);
    cursor = parseTimeToMinutes(scheduled.endTime);

    if (item.type === "activity" && item.landmarkIntensity === "high") {
      needsRecoveryRest = true;
    }
  }

  for (const item of optional) {
    const travel = nextTravel();
    const trial = scheduleOne(item, cursor + travel, plan);
    const trialEnd = parseTimeToMinutes(trial.endTime);
    const trialDinner = dinnerStartFromCursor(
      trialEnd + defaultTravelMin(plan),
      plan,
      hasGrocery,
      dinnerMin,
    );
    if (trialDinner <= latestDinnerStart) {
      result.push(trial);
      cursor = trialEnd;
    }
  }

  const eveningTravel = result.length > 0 ? defaultTravelMin(plan) : 0;
  let endCursor = cursor + eveningTravel;

  const groceryLead = hasGrocery
    ? GROCERY_DURATION_MIN + defaultTravelMin(plan) * 2
    : defaultTravelMin(plan);
  const latestItemEnd = latestDinnerStart - groceryLead;

  if (endCursor > latestItemEnd && result.length > 0) {
    const lastIdx = result.length - 1;
    const last = result[lastIdx];
    const minDuration = last.type === "activity" ? 45 : 20;
    const shortenedEnd = Math.max(parseTimeToMinutes(last.time) + minDuration, latestItemEnd);
    if (shortenedEnd < parseTimeToMinutes(last.endTime)) {
      result[lastIdx] = { ...last, endTime: minutesToTime(shortenedEnd) };
      cursor = shortenedEnd;
      endCursor = shortenedEnd + eveningTravel;
    }
  }

  if (hasGrocery) {
    const travel = defaultTravelMin(plan);
    let groceryStart = endCursor + travel;
    const latestGroceryStart = dinnerMin - GROCERY_DURATION_MIN - travel;
    if (groceryStart > latestGroceryStart) {
      groceryStart = Math.max(endCursor + travel, latestGroceryStart);
    }

    result.push({
      ...groceryItems[0],
      time: minutesToTime(groceryStart),
      endTime: minutesToTime(groceryStart + GROCERY_DURATION_MIN),
    });
    endCursor = groceryStart + GROCERY_DURATION_MIN + travel;
  }

  let dinnerStart = Math.max(dinnerMin, endCursor);
  let dinnerEnd = dinnerStart + dinnerDuration;
  if (dinnerEnd > dinnerMax) {
    dinnerEnd = dinnerMax;
    dinnerStart = Math.max(dinnerMin, dinnerEnd - dinnerDuration);
  }
  if (dinnerStart < endCursor) {
    dinnerStart = endCursor;
    dinnerEnd = Math.min(dinnerStart + dinnerDuration, dinnerMax);
  }

  const anchoredDinners = dinnerItems.map((d) => ({
    ...d,
    time: minutesToTime(dinnerStart),
    endTime: minutesToTime(dinnerEnd),
  }));

  return [...result, ...anchoredDinners];
}
