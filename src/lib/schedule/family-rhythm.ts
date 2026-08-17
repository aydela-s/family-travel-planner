/**
 * Family-day rhythm: schedule around naps, meals, and downtime rather than
 * filling every open slot. Used by the linear scheduler and integrity checks.
 */

import { INTEREST_CATEGORY_DEFAULTS } from "@/lib/schedule/interest-category-defaults";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { activityLoadAgeBand } from "@/lib/schedule/activity-load";
import { getNapWindow, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  BREAKFAST_DURATION_MIN,
  isGroceryTitle,
  isUnpaidTimelineActivity,
  itemDurationMin,
  MEAL_DURATION_MIN,
  minutesToTime,
} from "@/lib/schedule/timeline";
import type { LandmarkInterestTag } from "@/config/city-pricing";
import type { ActivityType } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";
import type { SlotKind } from "@/lib/planning-engine/types";

/** Sit-down / delivery lunch when backing the morning into a fixed nap. */
export const PRE_NAP_LUNCH_DURATION_MIN = 45;

/** Shortest visit we will assign to a major attraction unless allowShortVisit. */
export const MIN_MAJOR_ATTRACTION_MIN = 60;

/** Absolute floor for any paid attraction that was not explicitly marked short. */
export const MIN_IMPLICIT_ATTRACTION_MIN = 45;

export type AfternoonPattern =
  | "immediate"
  | "downtime_then_out"
  | "downtime_home_dinner"
  | "no_afternoon";

export type RhythmActivity = {
  type: ActivityType;
  title: string;
  slotKind?: SlotKind;
  interestTags?: LandmarkInterestTag[];
  /** When true, a 15-minute visit is an intentional choice, not compression. */
  allowShortVisit?: boolean;
};

export type MorningChainPlan = {
  breakfastStartMin?: number;
  activityStartMin: number;
  activityEndMin: number;
  lunchStartMin: number;
  lunchDurationMin: number;
};

export function isPaidAttraction(item: RhythmActivity): boolean {
  if (item.type !== "activity") return false;
  if (isGroceryTitle(item.title)) return false;
  return !isUnpaidTimelineActivity(item);
}

function categoryDurationMin(tags: LandmarkInterestTag[] | undefined): number | null {
  if (!tags?.length) return null;
  let best: number | null = null;
  for (const tag of tags) {
    const defaults = INTEREST_CATEGORY_DEFAULTS[tag];
    if (!defaults) continue;
    if (best == null || defaults.durationMin > best) best = defaults.durationMin;
  }
  return best;
}

function categoryTypicalDuration(tags: LandmarkInterestTag[] | undefined): number | null {
  if (!tags?.length) return null;
  let best: { durationMin: number; durationMax: number } | null = null;
  for (const tag of tags) {
    const defaults = INTEREST_CATEGORY_DEFAULTS[tag];
    if (!defaults) continue;
    if (!best || defaults.durationMax > best.durationMax) best = defaults;
  }
  return best ? Math.round((best.durationMin + best.durationMax) / 2) : null;
}

/**
 * Shortest duration a stop may keep. Major attractions cannot silently become
 * 15-minute placeholders to make a nap or dinner fit.
 */
export function minRealisticActivityDuration(item: RhythmActivity, plan: TripPlan): number {
  if (item.allowShortVisit) return 15;
  if (item.slotKind === "extra_activity") return 45;
  if (item.type === "meal") {
    return /\bbreakfast\b/i.test(item.title) || item.slotKind === "breakfast"
      ? BREAKFAST_DURATION_MIN
      : 40;
  }
  if (item.type === "nap") return 45;
  if (item.type === "travel") return 1;
  if (!isPaidAttraction(item)) {
    return Math.min(itemDurationMin(item, plan), 40);
  }
  const catMin = categoryDurationMin(item.interestTags);
  if (catMin != null) return Math.max(catMin, MIN_IMPLICIT_ATTRACTION_MIN);
  return Math.max(MIN_MAJOR_ATTRACTION_MIN, MIN_IMPLICIT_ATTRACTION_MIN);
}

/** Desired (not minimum) visit length — typical category visit, never below the floor. */
export function desiredActivityDuration(item: RhythmActivity, plan: TripPlan): number {
  const floor = minRealisticActivityDuration(item, plan);
  const typical = categoryTypicalDuration(item.interestTags);
  const tagged = itemDurationMin(item, plan);
  return Math.max(floor, typical ?? tagged);
}

export function postNapDowntimeMin(plan: TripPlan): number {
  if (!shouldIncludeNaps(plan)) return 0;
  const style = plan.travelStyle || "balanced";
  const young = activityLoadAgeBand(plan) === "young";
  if (style === "packed") return 15;
  if (style === "relaxed") return young ? 90 : 60;
  // balanced
  return young ? 90 : 45;
}

export function afternoonActivityDefaultTime(plan: TripPlan): string {
  if (!shouldIncludeNaps(plan)) return "13:15";
  const nap = getNapWindow(plan);
  if (!nap) return "13:15";
  const delay = postNapDowntimeMin(plan);
  return minutesToTime(Math.min(nap.endMin + delay, 17 * 60));
}

export function chooseAfternoonPattern(
  plan: TripPlan,
  opts: {
    morningDurationMin: number;
    hasAfternoonSlot: boolean;
    remainingAfterNapMin: number;
    dinnerAtStay: boolean;
  },
): AfternoonPattern {
  if (!opts.hasAfternoonSlot) return "no_afternoon";
  const style = plan.travelStyle || "balanced";
  const young = activityLoadAgeBand(plan) === "young";
  const nap = shouldIncludeNaps(plan);
  const minAfternoon = MIN_IMPLICIT_ATTRACTION_MIN;
  const downtime = postNapDowntimeMin(plan);
  const travel = 15;
  const remaining = opts.remainingAfterNapMin;

  if (style === "packed") return "immediate";

  if (!nap) return "immediate";

  if (remaining < downtime + minAfternoon + travel) {
    return "no_afternoon";
  }

  if (style === "relaxed" && young && opts.morningDurationMin >= 90) {
    return "no_afternoon";
  }

  if (opts.dinnerAtStay) return "downtime_home_dinner";
  return "downtime_then_out";
}

/**
 * Work backward from a fixed nap or lunch so a 10:00-open venue can start at
 * 10:00 instead of being delayed until just before the meal.
 */
export function planMorningChainFromNap(opts: {
  napStartMin?: number;
  lunchStartMin?: number;
  activityDurationMin: number;
  breakfast: boolean;
  lunchAtStay: boolean;
  travelMin: number;
  venueOpenMin?: number;
  breakfastDurationMin?: number;
  lunchDurationMin?: number;
}): MorningChainPlan {
  const lunchDurationMin = opts.lunchDurationMin ?? PRE_NAP_LUNCH_DURATION_MIN;
  const breakfastDurationMin = opts.breakfastDurationMin ?? BREAKFAST_DURATION_MIN;
  const travel = Math.max(0, opts.travelMin);
  const duration = opts.activityDurationMin;
  const open = opts.venueOpenMin;

  const latestActivityEnd =
    opts.napStartMin != null
      ? opts.lunchAtStay
        ? opts.napStartMin - lunchDurationMin - travel
        : opts.napStartMin - travel - lunchDurationMin - travel
      : (opts.lunchStartMin ?? 12 * 60) - travel;

  let activityStartMin = latestActivityEnd - duration;
  if (open != null && open + duration <= latestActivityEnd) {
    // Opening time fits — do not delay the visit until the last possible slot.
    activityStartMin = open;
  } else if (open != null) {
    activityStartMin = Math.max(open, latestActivityEnd - duration);
  }
  const activityEndMin = activityStartMin + duration;
  const lunchStartMin =
    opts.napStartMin != null
      ? Math.min(activityEndMin + travel, opts.napStartMin - lunchDurationMin)
      : activityEndMin + travel;

  let breakfastStartMin: number | undefined;
  if (opts.breakfast) {
    breakfastStartMin = Math.max(
      7 * 60 + 30,
      activityStartMin - breakfastDurationMin - 5,
    );
  }

  return {
    breakfastStartMin,
    activityStartMin,
    activityEndMin,
    lunchStartMin,
    lunchDurationMin,
  };
}

/**
 * After the last outing, sitting at a restaurant for a long dead wait is worse
 * than going home and leaving later (or eating at the stay).
 */
export function preferReturnHomeBeforeDinner(
  plan: TripPlan,
  lastActivityEndMin: number,
  dinnerStartMin: number,
  travelMin: number,
): boolean {
  const idleAtRestaurant = dinnerStartMin - lastActivityEndMin - travelMin;
  if (idleAtRestaurant < 30) return false;
  const young =
    getFamilyAgeProfile(plan).hasToddler || getFamilyAgeProfile(plan).hasYoungChild;
  const style = plan.travelStyle || "balanced";
  if (young && (style === "balanced" || style === "relaxed")) return idleAtRestaurant >= 20;
  return idleAtRestaurant >= 45;
}

/** Dinner belongs in the meal window — not at whatever time the last stop ended. */
export function dinnerStartFromRhythm(
  plan: TripPlan,
  lastOutEndMin: number,
  travelMin: number,
  dinnerWindow: { minMin: number; maxMin: number; defaultMin: number },
): number {
  const latestStart = dinnerWindow.maxMin - MEAL_DURATION_MIN;
  const afterLast = lastOutEndMin + travelMin;
  // Never pull dinner earlier than the window just to occupy idle time.
  const start = Math.max(dinnerWindow.defaultMin, dinnerWindow.minMin, afterLast);
  return Math.min(start, latestStart);
}

export function earliestLeaveAfterNap(plan: TripPlan, napEndMin: number): number {
  return napEndMin + postNapDowntimeMin(plan);
}

/** True when this stop may be dropped rather than compressed below a realistic visit. */
export function canDropToProtectDuration(item: RhythmActivity, plan: TripPlan): boolean {
  if (!isPaidAttraction(item)) return false;
  if (plan.travelStyle === "packed") return false;
  if (item.slotKind === "morning_activity") return false;
  if (item.slotKind === "extra_activity") return true;
  if (item.slotKind === "afternoon_activity") return true;
  return true;
}
