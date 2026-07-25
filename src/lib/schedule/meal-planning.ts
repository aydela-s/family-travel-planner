import { LandmarkInterestTag, LandmarkIntensity } from "@/config/city-pricing";
import { isOptionalActivity } from "@/lib/planning-engine/day-intent";
import {
  dinnerTimeWindow,
  lunchTimeWindow,
} from "@/lib/planning-engine/meal-timing";
import { SlotKind } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";
import {
  INTEREST_CATEGORY_DEFAULTS,
  packedLongerDurationForTags,
} from "@/lib/schedule/interest-category-defaults";
import { getNapWindow, getRegularNapWindows, napDurationMin, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import { formatMeridiemTime } from "@/lib/planning-engine/nap-options";
import { PACKED_EXTRA_MIN_DURATION_MIN } from "@/lib/schedule/travel-style";
import {
  defaultDurationMin,
  defaultTravelMin,
  GROCERY_DURATION_MIN,
  GROCERY_TO_DINNER_BUFFER_MIN,
  HIGH_INTENSITY_REST_BONUS_MIN,
  itemDurationMin,
  minutesToTime,
  parseTimeToMinutes,
  scheduleSpan,
} from "@/lib/schedule/timeline";

type RawActivity = {
  time: string;
  endTime?: string;
  title: string;
  type: ActivityType;
  notes?: string;
  slotKind?: SlotKind;
  landmarkIntensity?: LandmarkIntensity;
  interestTags?: LandmarkInterestTag[];
};

const GROCERY = /\bgrocery\b/i;
const RESTAURANT =
  /\b(restaurant|sit-down|dinner in|lunch in|lunch at|dinner at|breakfast at|café|cafe)\b/i;
const COOK_DINNER = /\bcook dinner|dinner at your rental|cook at your|cook at accommodation\b/i;
const PICNIC = /\bpicnic\b/i;
const RETURN_HOME = /\breturn to|back to (your )?(rental|accommodation|stay|hotel|home)\b/i;

/** Minimum lunch length when a nap follows later the same morning. */
export const MIN_LUNCH_DURATION_MIN = 40;
/** How far a typed nap may slip later so lunch still fits. */
export const NAP_START_SLIP_MAX_MIN = 30;
/**
 * When a nap follows soon after a morning stop, lunch may start this many
 * minutes before the age-based window so a full meal still fits.
 */
export const LUNCH_EARLY_FLEX_MIN = 45;
/** Absolute earliest lunch when flexing early for a nap (11:00). */
export const LUNCH_EARLY_ABSOLUTE_MIN = 11 * 60;
/**
 * Picnic / café lunch is almost always at or beside the morning stop — don't insert
 * a full city hop between them (that was forcing overlaps or lunch past its window).
 */
export const NEAR_STOP_LUNCH_TRANSFER_MIN = 5;

/**
 * Prefer the typed nap start; if a full lunch (≥40 min) cannot begin near the
 * age-based lunch window before that nap, slip the nap by up to 30 minutes.
 * Lunch may also start slightly before the window (LUNCH_EARLY_FLEX_MIN).
 */
export function resolveNapStartAroundLunch(opts: {
  preferredNapStart: number;
  lunchBeforeNap: boolean;
  travelMin: number;
  lunchWindowMin: number;
}): number {
  const { preferredNapStart, lunchBeforeNap, travelMin, lunchWindowMin } = opts;
  if (!lunchBeforeNap) return preferredNapStart;

  const lunchFloor = Math.max(
    LUNCH_EARLY_ABSOLUTE_MIN,
    lunchWindowMin - LUNCH_EARLY_FLEX_MIN,
  );
  const needLunchStart = preferredNapStart - travelMin - MIN_LUNCH_DURATION_MIN;
  if (needLunchStart >= lunchFloor) {
    return preferredNapStart;
  }

  const slipped = lunchFloor + MIN_LUNCH_DURATION_MIN + travelMin;
  return Math.min(preferredNapStart + NAP_START_SLIP_MAX_MIN, Math.max(preferredNapStart, slipped));
}

/** Earliest allowed lunch start when a nap follows (window with early flex). */
export function lunchFloorBeforeNap(plan: TripPlan): number {
  const { minMin } = lunchTimeWindow(plan);
  return Math.max(LUNCH_EARLY_ABSOLUTE_MIN, minMin - LUNCH_EARLY_FLEX_MIN);
}

/** Travel gap into lunch — short when eating at/near the previous activity stop. */
function transferIntoLunch(
  previous: RawActivity | undefined,
  defaultTravel: number,
): number {
  if (previous?.type === "activity") {
    return Math.min(defaultTravel, NEAR_STOP_LUNCH_TRANSFER_MIN);
  }
  return defaultTravel;
}


export function isGroceryActivity(a: RawActivity): boolean {
  // Title only — cook-at-home notes say "Grocery-based dinner" and must not match.
  if (COOK_DINNER.test(a.title)) return false;
  return GROCERY.test(a.title);
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

function isThemeParkActivity(a: RawActivity): boolean {
  return Boolean(a.interestTags?.includes("theme-parks"));
}

function packedActivityDuration(
  item: RawActivity,
  plan: TripPlan,
  fewerLonger: boolean,
): number {
  const base = itemDurationMin(item, plan);
  // Theme parks are half-day commitments after lunch — don't run 4h before the meal.
  if (
    isThemeParkActivity(item) &&
    item.slotKind === "afternoon_activity" &&
    isLengthenablePackedActivity(item)
  ) {
    return Math.max(base, INTEREST_CATEGORY_DEFAULTS["theme-parks"].durationMin);
  }
  if (fewerLonger && isLengthenablePackedActivity(item)) {
    return Math.max(base, packedLongerDurationForTags(item.interestTags));
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
      const target = packedLongerDurationForTags(item.interestTags);
      if (current < target) {
        out[i] = {
          ...item,
          endTime: minutesToTime(start + target),
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
  const title = a.title.toLowerCase();
  // Prefer the title — notes may mention dinner while describing lunch/breakfast.
  if (COOK_DINNER.test(title) || title.includes("dinner")) return true;
  if (title.includes("lunch") || title.includes("breakfast") || title.includes("picnic")) {
    return false;
  }
  return parseTimeToMinutes(a.time) >= 17 * 60;
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
  durationMin?: number,
): T & { endTime: string } {
  const duration = durationMin ?? itemDurationMin(item, plan);
  return {
    ...item,
    time: minutesToTime(start),
    endTime: minutesToTime(start + duration),
  };
}

function optionalTryDurations(item: RawActivity, plan: TripPlan): number[] {
  const base = itemDurationMin(item, plan);
  if (plan.travelStyle !== "packed" || item.slotKind !== "extra_activity") {
    return [base];
  }
  return [...new Set([base, 60, 50, PACKED_EXTRA_MIN_DURATION_MIN])].sort((a, b) => b - a);
}

/** Cap transfer into a packed extra so a far landmark can't erase the third stop. */
function travelIntoOptional(item: RawActivity, requestedTravel: number, plan: TripPlan): number {
  if (item.slotKind !== "extra_activity") return requestedTravel;
  const base = defaultTravelMin(plan);
  return Math.min(requestedTravel, Math.max(base, 35));
}

/**
 * Place an optional stop (packed extra / stroll). For packed extras, try shorter
 * durations and shrink the prior afternoon activity so the third stop survives naps.
 */
function placeOptionalActivity<T extends RawActivity>(
  item: T,
  opts: {
    cursor: number;
    travel: number;
    plan: TripPlan;
    hasGrocery: boolean;
    dinnerMin: number;
    latestDinnerStart: number;
    latestItemEnd: number;
    result: Array<RawActivity & { endTime: string }>;
  },
): { activity: T & { endTime: string }; cursor: number } | null {
  const { plan, hasGrocery, dinnerMin, latestDinnerStart, latestItemEnd, result } = opts;
  let cursor = opts.cursor;
  const travel = travelIntoOptional(item, opts.travel, plan);
  // After the extra, dinner transfer stays the real gap (or default) — not the capped inbound hop.
  const travelAfter = opts.travel;

  const fits = (end: number) => {
    if (end > latestItemEnd) return false;
    const trialDinner = dinnerStartFromCursor(end + travelAfter, plan, hasGrocery, dinnerMin);
    return trialDinner <= latestDinnerStart;
  };

  const tryAtCursor = (startCursor: number) => {
    for (const duration of optionalTryDurations(item, plan)) {
      const start = startCursor + travel;
      const end = start + duration;
      if (!fits(end)) continue;
      return {
        activity: scheduleOne(item, start, plan, duration),
        cursor: end,
      };
    }
    return null;
  };

  const direct = tryAtCursor(cursor);
  if (direct) return direct;

  // Packed: free room by shortening the last real activity, then retry a short extra.
  if (plan.travelStyle !== "packed" || item.slotKind !== "extra_activity") {
    return null;
  }

  for (let i = result.length - 1; i >= 0; i--) {
    const prior = result[i]!;
    if (!isLengthenablePackedActivity(prior)) continue;
    const priorStart = parseTimeToMinutes(prior.time);
    const priorEnd = parseTimeToMinutes(prior.endTime);
    const minKeep = 50;
    // Need: priorEnd + travel + extraMin + (reserved via latestItemEnd) ≤ latestItemEnd
    const maxPriorEnd = latestItemEnd - travel - PACKED_EXTRA_MIN_DURATION_MIN;
    // travel here is already capped for packed extras
    if (maxPriorEnd < priorStart + minKeep) continue;
    if (maxPriorEnd >= priorEnd) continue;

    result[i] = {
      ...prior,
      endTime: minutesToTime(maxPriorEnd),
    };
    // Shift anything after the shortened stop (usually nothing before optionals).
    let shiftCursor = maxPriorEnd;
    for (let j = i + 1; j < result.length; j++) {
      const next = result[j]!;
      const nextDur = parseTimeToMinutes(next.endTime) - parseTimeToMinutes(next.time);
      const nextStart = shiftCursor + defaultTravelMin(plan);
      result[j] = {
        ...next,
        ...scheduleSpan(nextStart, nextDur),
      };
      shiftCursor = nextStart + nextDur;
    }
    cursor = shiftCursor;
    return tryAtCursor(cursor);
  }

  return null;
}

/**
 * Linear day scheduler — walks activities in list order (no nap-bucket drops).
 * Dinner and grocery are anchored to the evening; optional intents may be skipped.
 */
export function rescheduleActivitiesWithMealAnchors<T extends RawActivity>(
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
  const regularNapWindows = shouldIncludeNaps(plan) ? getRegularNapWindows(plan) : [];
  // Always try the packed extra; lengthen remaining stops only if it does not fit.
  // Pre-dropping the extra made packed+nap schedules look identical to balanced.
  const optionalToPlace = optional;

  const { minMin: dinnerMin, maxMin: dinnerMax } = dinnerTimeWindow(plan);
  const dinnerDuration = defaultDurationMin("meal", plan);
  const latestDinnerStart = dinnerMax - dinnerDuration;
  const hasGrocery = groceryItems.length > 0;
  // Reserve travel (and grocery) after the last daytime stop — used while placing
  // required items (theme parks fill until dinner) and when placing optionals.
  const reservedAfterLast = hasGrocery
    ? GROCERY_DURATION_MIN +
      defaultTravelMin(plan) +
      Math.max(defaultTravelMin(plan), GROCERY_TO_DINNER_BUFFER_MIN)
    : defaultTravelMin(plan);
  const latestItemEnd = latestDinnerStart - reservedAfterLast;

  const result: (T & { endTime: string })[] = [];
  let cursor = 8 * 60;
  let travelIdx = 0;
  let needsRecoveryRest = false;
  let regularNapSeen = 0;

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
    const travelRaw = result.length > 0 ? nextTravel() : 0;
    // Stay-home lunch → stay-home nap: no transit gap (was slipping 12:00 naps to 12:10).
    const travel =
      item.type === "nap" &&
      result.length > 0 &&
      /takeout or delivery lunch at your stay|cook dinner at your rental/i.test(
        result[result.length - 1]!.title,
      )
        ? 0
        : travelRaw;
    const lunchIdx = required.findIndex((a, j) => j > i && isDaytimeMeal(a));
    let start: number;
    const thisNapWindow =
      item.type === "nap" ? regularNapWindows[regularNapSeen] ?? napWindow : null;
    if (item.type === "nap") regularNapSeen += 1;

    if (item.type === "nap" && thisNapWindow && resolvedNapStart != null) {
      // First regular nap uses lunch-slip resolution; later naps keep their own start.
      const preferred =
        regularNapSeen === 1 ? resolvedNapStart : thisNapWindow.startMin;
      start = preferred;
      if (cursor + travel > preferred) {
        const napLen = napDurationMin(plan, thisNapWindow);
        const latestStart = Math.max(preferred, thisNapWindow.endMin - napLen);
        start = Math.min(Math.max(cursor + travel, preferred), latestStart);
      }
    } else if (isDaytimeMeal(item)) {
      const { maxMin: lunchMax, minMin } = lunchTimeWindow(plan);
      const lunchTravel = transferIntoLunch(result[result.length - 1], travel);
      const natural = cursor + lunchTravel;
      // When nap follows, start lunch early enough for a full 40-minute meal —
      // allow a bit of early flex before the age window when needed.
      if (napRequiredIdx > i && resolvedNapStart != null) {
        const gap = defaultTravelMin(plan);
        const floor = lunchFloorBeforeNap(plan);
        const latestLunchStart = resolvedNapStart - gap - MIN_LUNCH_DURATION_MIN;
        start = Math.min(Math.max(natural, floor), Math.max(floor, latestLunchStart));
        if (start > latestLunchStart && latestLunchStart >= floor) start = latestLunchStart;
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

    // Packed + early mornings: fill toward lunch, but never overrun the lunch window.
    if (
      plan.travelStyle === "packed" &&
      item.slotKind === "morning_activity" &&
      isLengthenablePackedActivity(item) &&
      !isThemeParkActivity(item)
    ) {
      const lunchMin = lunchTimeWindow(plan).minMin;
      const lunchTransfer = defaultTravelMin(plan);
      const fillUntil = lunchMin - lunchTransfer;
      if (fillUntil > start) {
        const room = fillUntil - start;
        // Stretch into empty morning time, but cap so lunch can still start on time.
        duration = Math.min(Math.max(duration, Math.min(room, 3 * 60)), room);
      }
    }

    // Theme parks: run from right after lunch through dinner — no idle afternoon gap.
    if (
      isThemeParkActivity(item) &&
      item.slotKind === "afternoon_activity" &&
      isLengthenablePackedActivity(item) &&
      latestItemEnd > start
    ) {
      duration = latestItemEnd - start;
    }

    // Finish earlier activities in time for the (possibly slipped) nap start.
    // When lunch sits before the nap, priors must end before that early lunch — not only before nap
    // (otherwise lunch is pulled to 11:00 while morning still runs until 11:30).
    if (item.type !== "nap" && napRequiredIdx > i && resolvedNapStart != null) {
      const gap = defaultTravelMin(plan);
      let mustEndBy = resolvedNapStart - gap;
      if (lunchIdx > i && lunchIdx < napRequiredIdx && !isDaytimeMeal(item)) {
        const lunchFloor = lunchFloorBeforeNap(plan);
        const { maxMin: lunchMax } = lunchTimeWindow(plan);
        const latestLunchStart = resolvedNapStart - gap - MIN_LUNCH_DURATION_MIN;
        const lunchStartCap = Math.max(lunchFloor, Math.min(lunchMax, latestLunchStart));
        const lunchTransfer = transferIntoLunch(item, gap);
        mustEndBy = Math.min(mustEndBy, lunchStartCap - lunchTransfer);
      }
      if (isDaytimeMeal(item)) {
        const lunchFloor = lunchFloorBeforeNap(plan);
        // Prefer moving lunch earlier over shrinking below a usable meal.
        if (mustEndBy - lunchFloor >= MIN_LUNCH_DURATION_MIN) {
          start = Math.min(start, mustEndBy - MIN_LUNCH_DURATION_MIN);
          start = Math.max(lunchFloor, start);
          duration = Math.max(
            MIN_LUNCH_DURATION_MIN,
            Math.min(duration, mustEndBy - start),
          );
        } else {
          // Still tight even with early flex — take the full early window.
          start = lunchFloor;
          duration = Math.max(20, Math.min(MIN_LUNCH_DURATION_MIN, mustEndBy - start));
        }
        if (start + duration > mustEndBy) {
          duration = Math.max(20, mustEndBy - start);
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
      const lunchTransfer = transferIntoLunch(item, gap);
      let lunchStartDeadline = lunchMax;
      if (napRequiredIdx > lunchIdx && resolvedNapStart != null) {
        const lunchFloor = lunchFloorBeforeNap(plan);
        const latestLunchStart = resolvedNapStart - gap - MIN_LUNCH_DURATION_MIN;
        lunchStartDeadline = Math.max(lunchFloor, Math.min(lunchMax, latestLunchStart));
      }
      let budget = lunchStartDeadline - lunchTransfer;
      for (let k = lunchIdx - 1; k > i; k--) {
        budget -= gap + 20;
      }
      const maxEnd = budget;
      if (start >= maxEnd) {
        start = Math.max(cursor + (result.length > 0 ? gap : 0), maxEnd - 20);
      }
      duration = Math.min(duration, Math.max(20, maxEnd - start));
    }

    // Hard invariant: never start before the previous item ends (+ transfer).
    // For near-stop lunch, trim the previous activity rather than overlapping it.
    if (result.length > 0) {
      const lunchTransfer = isDaytimeMeal(item)
        ? transferIntoLunch(result[result.length - 1], travel)
        : travel;
      const earliest = cursor + lunchTransfer;
      if (start < earliest) {
        if (isDaytimeMeal(item)) {
          const { maxMin: lunchMax } = lunchTimeWindow(plan);
          const targetStart = Math.min(Math.max(start, lunchFloorBeforeNap(plan)), lunchMax);
          const prev = result[result.length - 1]!;
          const prevStart = parseTimeToMinutes(prev.time);
          const prevEndNeeded = targetStart - lunchTransfer;
          if (prevEndNeeded >= prevStart + 20) {
            const trimmed = {
              ...prev,
              ...scheduleSpan(prevStart, prevEndNeeded - prevStart),
            };
            result[result.length - 1] = trimmed;
            cursor = prevEndNeeded;
            start = Math.max(targetStart, cursor + lunchTransfer);
            start = Math.min(start, lunchMax);
          } else {
            // Still keep lunch in-window when possible by ending prior ASAP.
            const tightEnd = Math.max(prevStart + 15, Math.min(cursor, lunchMax - lunchTransfer));
            if (tightEnd > prevStart) {
              result[result.length - 1] = {
                ...prev,
                ...scheduleSpan(prevStart, tightEnd - prevStart),
              };
              cursor = tightEnd;
            }
            start = Math.min(Math.max(cursor + lunchTransfer, start), lunchMax);
          }
        } else {
          start = earliest;
        }
      }
    }

    // If lunch still sits before a nap, re-clamp duration after any start push/trim.
    if (isDaytimeMeal(item) && napRequiredIdx > i && resolvedNapStart != null) {
      const gap = defaultTravelMin(plan);
      const mustEndBy = resolvedNapStart - gap;
      if (start + duration > mustEndBy) {
        duration = Math.max(20, mustEndBy - start);
      }
    }

    if (item.type === "nap" && thisNapWindow) {
      // Stay inside the typed window for the core nap; recovery bonus may run slightly past it.
      const intended = napDurationMin(plan, thisNapWindow);
      const bonus = Math.max(0, duration - intended);
      const room = thisNapWindow.endMin - start;
      if (room >= 20) {
        duration = Math.min(intended + bonus, room + bonus);
      } else if (room > 0) {
        duration = Math.max(20, room) + bonus;
      } else {
        start = Math.max(thisNapWindow.startMin, thisNapWindow.endMin - intended);
        duration = Math.max(20, thisNapWindow.endMin - start) + bonus;
      }
    }

    const span = scheduleSpan(start, duration);
    const scheduled = {
      ...item,
      ...span,
      ...(item.type === "nap" && thisNapWindow
        ? {
            // Always echo the family's chosen window in the note (not travel-slip clock times).
            notes: `Protected downtime ${formatMeridiemTime(thisNapWindow.startMin)}–${formatMeridiemTime(thisNapWindow.endMin)}.`,
          }
        : item.type === "nap"
          ? {
              notes: `Protected downtime ${formatMeridiemTime(start)}–${formatMeridiemTime(start + duration)}.`,
            }
          : {}),
    };
    result.push(scheduled);
    cursor = parseTimeToMinutes(scheduled.endTime);

    if (item.type === "activity" && item.landmarkIntensity === "high") {
      needsRecoveryRest = true;
    }
  }

  const eveningTravel = result.length > 0 ? defaultTravelMin(plan) : 0;
  // latestItemEnd already computed above for theme-park fill + optional placement.

  for (const item of optionalToPlace) {
    const travel = nextTravel();
    const placed = placeOptionalActivity(item, {
      cursor,
      travel,
      plan,
      hasGrocery,
      dinnerMin,
      latestDinnerStart,
      latestItemEnd,
      result,
    });
    if (placed) {
      result.push(placed.activity);
      cursor = placed.cursor;
    }
  }

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

  // Lengthen remaining stops when packed lost the third stop — except theme-park
  // half-days, where the park itself is the longer adventure.
  const resultHasThemePark = result.some(isThemeParkActivity);
  if (
    plan.travelStyle === "packed" &&
    !result.some((a) => a.slotKind === "extra_activity") &&
    !resultHasThemePark
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

  const dinnerSpan = scheduleSpan(dinnerStart, Math.max(20, dinnerEnd - dinnerStart));
  const anchoredDinners = dinnerItems.map((d) => ({
    ...d,
    time: dinnerSpan.time,
    endTime: dinnerSpan.endTime,
  }));

  return [...result, ...anchoredDinners];
}
