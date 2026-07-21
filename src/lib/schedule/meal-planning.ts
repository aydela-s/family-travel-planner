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
import { PACKED_LONGER_ACTIVITY_MIN } from "@/lib/schedule/travel-style";
import {
  defaultDurationMin,
  defaultTravelMin,
  GROCERY_DURATION_MIN,
  GROCERY_TO_DINNER_BUFFER_MIN,
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

/** Minimum lunch length when a nap follows later the same morning. */
export const MIN_LUNCH_DURATION_MIN = 40;
/** How far a typed nap may slip later so lunch still fits. */
export const NAP_START_SLIP_MAX_MIN = 30;

/**
 * Prefer the typed nap start; if a full lunch (≥40 min) cannot begin at the
 * age-based lunch window start before that nap, slip the nap by up to 30 minutes.
 */
export function resolveNapStartAroundLunch(opts: {
  preferredNapStart: number;
  lunchBeforeNap: boolean;
  travelMin: number;
  lunchWindowMin: number;
}): number {
  const { preferredNapStart, lunchBeforeNap, travelMin, lunchWindowMin } = opts;
  if (!lunchBeforeNap) return preferredNapStart;

  // Use the real lunch-window floor — not an earlier absolute clock — so we
  // don't keep a noon nap when toddler lunch can't start until 11:30.
  const lunchFloor = lunchWindowMin;
  const needLunchStart = preferredNapStart - travelMin - MIN_LUNCH_DURATION_MIN;
  if (needLunchStart >= lunchFloor) {
    return preferredNapStart;
  }

  const slipped = lunchFloor + MIN_LUNCH_DURATION_MIN + travelMin;
  return Math.min(preferredNapStart + NAP_START_SLIP_MAX_MIN, Math.max(preferredNapStart, slipped));
}


export function isGroceryActivity(a: RawActivity): boolean {
  return GROCERY.test(a.title) || GROCERY.test(a.notes ?? "");
}

function isLengthenablePackedActivity(a: RawActivity): boolean {
  if (a.type !== "activity" || isGroceryActivity(a)) return false;
  // Rest / calm slots are typed as activity for display (FAM-14) but must stay short.
  if (
    a.slotKind === "midday_rest" ||
    a.slotKind === "afternoon_rest" ||
    a.slotKind === "evening_rest" ||
    a.slotKind === "calm_activity" ||
    a.slotKind === "return_home"
  ) {
    return false;
  }
  if (/\b(stroll|break|free time|calm family|pack up|low-key exploring)\b/i.test(a.title)) {
    return false;
  }
  return true;
}

function packedActivityDuration(
  item: RawActivity,
  plan: TripPlan,
  fewerLonger: boolean,
): number {
  const base = itemDurationMin(item, plan);
  if (fewerLonger && isLengthenablePackedActivity(item)) {
    return Math.max(base, PACKED_LONGER_ACTIVITY_MIN);
  }
  return base;
}

/** Expand packed activities to the longer duration and shift following items. */
export function applyPackedFewerLonger<T extends RawActivity & { endTime: string }>(
  scheduled: T[],
  plan: TripPlan,
): T[] {
  if (scheduled.length === 0) return scheduled;
  const gap = defaultTravelMin(plan);
  const out = scheduled.map((item) => ({ ...item }));

  for (let i = 0; i < out.length; i++) {
    const item = out[i];
    if (isLengthenablePackedActivity(item)) {
      const start = parseTimeToMinutes(item.time);
      const current = parseTimeToMinutes(item.endTime) - start;
      if (current < PACKED_LONGER_ACTIVITY_MIN) {
        out[i] = {
          ...item,
          endTime: minutesToTime(start + PACKED_LONGER_ACTIVITY_MIN),
        };
      }
    }

    if (i + 1 < out.length) {
      const prevEnd = parseTimeToMinutes(out[i].endTime);
      const next = out[i + 1];
      const nextStart = parseTimeToMinutes(next.time);
      const nextDur = parseTimeToMinutes(next.endTime) - nextStart;
      if (nextStart < prevEnd + gap) {
        const newStart = prevEnd + gap;
        out[i + 1] = {
          ...next,
          time: minutesToTime(newStart),
          endTime: minutesToTime(newStart + nextDur),
        };
      }
    }
  }

  return out;
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

/** Keep dinner inside its window without overlapping the previous item. */
export function anchorDinnerTimes<T extends RawActivity & { endTime?: string }>(
  activities: T[],
  plan: TripPlan,
): T[] {
  const { minMin, maxMin } = dinnerTimeWindow(plan);
  const dinnerDuration = defaultDurationMin("meal", plan);
  const latestStart = maxMin - dinnerDuration;
  const dinnerIdx = activities.findIndex(isDinnerMeal);
  if (dinnerIdx < 0) return activities;

  const dinner = activities[dinnerIdx];
  let start = parseTimeToMinutes(dinner.time);

  if (start < minMin) start = minMin;
  if (start > latestStart) start = latestStart;

  const prev = dinnerIdx > 0 ? activities[dinnerIdx - 1] : null;
  if (prev) {
    const prevEnd = prev.endTime
      ? parseTimeToMinutes(prev.endTime)
      : parseTimeToMinutes(prev.time) + defaultDurationMin(prev.type, plan);
    // Never pull dinner into the previous stop (packed days were overlapping here).
    start = Math.max(start, prevEnd);
  }

  let end = start + dinnerDuration;
  if (end > maxMin) {
    end = maxMin;
    // Prefer a shorter dinner over overlapping the prior activity.
    if (start > end - 20) {
      start = Math.min(start, Math.max(minMin, end - 20));
      if (prev) {
        const prevEnd = prev.endTime
          ? parseTimeToMinutes(prev.endTime)
          : parseTimeToMinutes(prev.time) + defaultDurationMin(prev.type, plan);
        start = Math.max(start, prevEnd);
      }
      end = Math.max(start + 20, Math.min(start + dinnerDuration, maxMin));
    }
  }

  return activities.map((a, i) =>
    i === dinnerIdx
      ? {
          ...a,
          time: minutesToTime(start),
          endTime: minutesToTime(end),
        }
      : a,
  );
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
    const groceryDinnerGap = Math.max(travel, GROCERY_TO_DINNER_BUFFER_MIN);
    let groceryStart = cursor + travel;
    const latestGroceryStart = minMin - GROCERY_DURATION_MIN - groceryDinnerGap;
    if (groceryStart > latestGroceryStart) {
      groceryStart = Math.max(cursor + travel, latestGroceryStart);
    }
    dinnerStart = Math.max(minMin, groceryStart + GROCERY_DURATION_MIN + groceryDinnerGap);
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
  // Always try the packed extra; lengthen remaining stops only if it does not fit.
  // Pre-dropping the extra made packed+nap schedules look identical to balanced.
  const optionalToPlace = optional;

  const { minMin: dinnerMin, maxMin: dinnerMax } = dinnerTimeWindow(plan);
  const dinnerDuration = defaultDurationMin("meal", plan);
  const latestDinnerStart = dinnerMax - dinnerDuration;
  const hasGrocery = groceryItems.length > 0;

  const result: (T & { endTime: string })[] = [];
  let cursor = 8 * 60;
  let travelIdx = 0;
  let needsRecoveryRest = false;

  const nextTravel = () => travelAfterEach[travelIdx++] ?? defaultTravelMin(plan);
  const napRequiredIdx = napWindow ? required.findIndex((a) => a.type === "nap") : -1;
  const lunchBeforeNap =
    napRequiredIdx > 0 && required.slice(0, napRequiredIdx).some((a) => isDaytimeMeal(a));
  const resolvedNapStart =
    napWindow != null
      ? resolveNapStartAroundLunch({
          preferredNapStart: napWindow.startMin,
          lunchBeforeNap,
          travelMin: defaultTravelMin(plan),
          lunchWindowMin: lunchTimeWindow(plan).minMin,
        })
      : null;

  for (let i = 0; i < required.length; i++) {
    const item = required[i];
    const travel = result.length > 0 ? nextTravel() : 0;
    const lunchIdx = required.findIndex((a, j) => j > i && isDaytimeMeal(a));
    let start: number;

    if (item.type === "nap" && napWindow && resolvedNapStart != null) {
      start = resolvedNapStart;
      if (cursor + travel > resolvedNapStart) {
        const napLen = napDurationMin(plan);
        const latestStart = Math.max(resolvedNapStart, napWindow.endMin - napLen);
        start = Math.min(Math.max(cursor + travel, resolvedNapStart), latestStart);
      }
    } else if (isDaytimeMeal(item)) {
      const { maxMin: lunchMax, minMin } = lunchTimeWindow(plan);
      const natural = cursor + travel;
      // When nap follows, start lunch early enough for a full 40-minute meal —
      // but stay inside the age-based lunch window.
      if (napRequiredIdx > i && resolvedNapStart != null) {
        const gap = defaultTravelMin(plan);
        const latestLunchStart = resolvedNapStart - gap - MIN_LUNCH_DURATION_MIN;
        start = Math.min(Math.max(natural, minMin), Math.max(minMin, latestLunchStart));
        if (start > latestLunchStart && latestLunchStart >= minMin) start = latestLunchStart;
      } else {
        // After a morning nap (or no nap ahead), stay inside the lunch window —
        // never let travel push lunch past lunchMax (toddler mornings were landing at 12:15).
        start = Math.min(Math.max(natural, minMin), lunchMax);
      }
    } else if (result.length === 0) {
      start = Math.max(cursor, parseTimeToMinutes(item.time));
    } else {
      start = cursor + travel;
    }

    let duration = packedActivityDuration(item, plan, false);
    if (
      needsRecoveryRest &&
      (item.type === "nap" ||
        item.type === "rest" ||
        item.slotKind === "afternoon_rest" ||
        item.slotKind === "midday_rest" ||
        /\b(break|free time)\b/i.test(item.title))
    ) {
      duration += HIGH_INTENSITY_REST_BONUS_MIN;
      needsRecoveryRest = false;
    }

    // Finish earlier activities in time for the (possibly slipped) nap start.
    if (item.type !== "nap" && napRequiredIdx > i && resolvedNapStart != null) {
      const gap = defaultTravelMin(plan);
      const mustEndBy = resolvedNapStart - gap;
      if (isDaytimeMeal(item)) {
        const { minMin: lunchMin } = lunchTimeWindow(plan);
        start = Math.min(start, mustEndBy - MIN_LUNCH_DURATION_MIN);
        start = Math.max(lunchMin, start);
        duration = Math.max(
          MIN_LUNCH_DURATION_MIN,
          Math.min(duration, mustEndBy - start),
        );
        if (start + duration > mustEndBy) {
          duration = Math.max(20, mustEndBy - start);
        }
        if (start + MIN_LUNCH_DURATION_MIN > mustEndBy) {
          start = Math.max(lunchMin, mustEndBy - MIN_LUNCH_DURATION_MIN);
          duration = Math.min(MIN_LUNCH_DURATION_MIN, Math.max(20, mustEndBy - start));
        }
      } else if (start < mustEndBy) {
        duration = Math.min(duration, Math.max(20, mustEndBy - start));
      } else {
        duration = Math.min(duration, 20);
      }
    }

    // Do not shrink naps to fit lunch — nap window (with slip) wins over lunch compression.
    if (lunchIdx > i && item.type !== "nap") {
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

    if (item.type === "nap" && napWindow) {
      // Stay inside the typed window; only the high-intensity recovery bonus may run past it.
      const withinWindow = Math.max(45, napWindow.endMin - start);
      const intended = napDurationMin(plan);
      const bonus = Math.max(0, duration - intended);
      duration = Math.min(duration, withinWindow + bonus);
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

  for (const item of optionalToPlace) {
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
  // Reserve travel (and grocery) after the last stop — do not double-count travel by
  // comparing lastEnd+travel against latestDinner-travel (that was dropping packed extras).
  const reservedAfterLast = hasGrocery
    ? GROCERY_DURATION_MIN +
      defaultTravelMin(plan) +
      Math.max(defaultTravelMin(plan), GROCERY_TO_DINNER_BUFFER_MIN)
    : defaultTravelMin(plan);
  const latestItemEnd = latestDinnerStart - reservedAfterLast;

  // Trim trailing stops until dinner can start on time with a real meal duration.
  while (result.length > 0 && cursor > latestItemEnd) {
    const lastIdx = result.length - 1;
    const last = result[lastIdx];
    const lastStart = parseTimeToMinutes(last.time);
    const minDuration =
      last.type === "nap"
        ? 45
        : last.type === "activity" && isLengthenablePackedActivity(last)
          ? 45
          : 20;
    const shortenedEnd = Math.max(lastStart + minDuration, latestItemEnd);
    if (shortenedEnd < parseTimeToMinutes(last.endTime)) {
      result[lastIdx] = { ...last, endTime: minutesToTime(shortenedEnd) };
      cursor = shortenedEnd;
      continue;
    }

    // Drop a packed extra (or other optional) that no longer fits before dinner.
    if (last.slotKind === "extra_activity" || isOptionalActivity(last)) {
      result.pop();
      cursor =
        result.length > 0 ? parseTimeToMinutes(result[result.length - 1].endTime) : 8 * 60;
      continue;
    }

    // Last resort: force-trim the final stop to the dinner boundary (never extend).
    const lastEnd = parseTimeToMinutes(last.endTime);
    if (latestItemEnd > lastStart && latestItemEnd < lastEnd) {
      result[lastIdx] = { ...last, endTime: minutesToTime(latestItemEnd) };
      cursor = latestItemEnd;
    }
    break;
  }

  // Lengthen remaining stops when packed and the optional extra was skipped (or trimmed off).
  if (
    plan.travelStyle === "packed" &&
    !result.some((a) => a.slotKind === "extra_activity")
  ) {
    const lengthened = applyPackedFewerLonger(result, plan);
    result.length = 0;
    result.push(...lengthened);
    if (result.length > 0) {
      cursor = parseTimeToMinutes(result[result.length - 1].endTime);
      // Re-trim if lengthening pushed past the dinner boundary.
      while (result.length > 0 && cursor > latestItemEnd) {
        const lastIdx = result.length - 1;
        const last = result[lastIdx];
        const lastStart = parseTimeToMinutes(last.time);
        const lastEnd = parseTimeToMinutes(last.endTime);
        if (latestItemEnd > lastStart && latestItemEnd < lastEnd) {
          result[lastIdx] = { ...last, endTime: minutesToTime(latestItemEnd) };
          cursor = latestItemEnd;
        }
        break;
      }
    }
  }

  let endCursor = cursor + eveningTravel;

  if (hasGrocery) {
    const travel = defaultTravelMin(plan);
    const groceryDinnerGap = Math.max(travel, GROCERY_TO_DINNER_BUFFER_MIN);
    let groceryStart = endCursor + travel;
    const latestGroceryStart = dinnerMin - GROCERY_DURATION_MIN - groceryDinnerGap;
    if (groceryStart > latestGroceryStart) {
      groceryStart = Math.max(endCursor + travel, latestGroceryStart);
    }

    result.push({
      ...groceryItems[0],
      time: minutesToTime(groceryStart),
      endTime: minutesToTime(groceryStart + GROCERY_DURATION_MIN),
    });
    // Use snapped grocery end so the dinner buffer survives time rounding.
    const groceryEnd = parseTimeToMinutes(result[result.length - 1].endTime);
    endCursor = groceryEnd + groceryDinnerGap;
  }

  let dinnerStart = Math.max(dinnerMin, Math.min(endCursor, latestDinnerStart));
  if (dinnerStart < endCursor) {
    // Still overlapping the prior stop — pull dinner forward only after trimming failed.
    dinnerStart = endCursor;
  }
  let dinnerEnd = dinnerStart + dinnerDuration;
  if (dinnerEnd > dinnerMax) {
    dinnerEnd = dinnerMax;
    if (dinnerStart > dinnerEnd - 20) {
      dinnerStart = Math.max(endCursor, dinnerEnd - 20);
      dinnerEnd = Math.max(dinnerStart + 20, Math.min(dinnerStart + dinnerDuration, dinnerMax));
    }
  }

  const anchoredDinners = dinnerItems.map((d) => ({
    ...d,
    time: minutesToTime(dinnerStart),
    endTime: minutesToTime(dinnerEnd),
  }));

  return [...result, ...anchoredDinners];
}
