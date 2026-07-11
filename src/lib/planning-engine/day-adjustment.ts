import { TripPlan } from "@/types/trip-plan";
import { getIntensityConfig, IntensityConfig } from "@/lib/schedule/travel-style";

export type AdjustmentContext = {
  landmarkOffset: number;
  relaxedDay: boolean;
  preferOutdoor: boolean;
  preferMuseum: boolean;
  addActivity: boolean;
  removeActivity: boolean;
  skipNap: boolean;
  forceCookDinner: boolean | null;
  forceEatOut: boolean | null;
  summaryNote: string;
};

function adjustHash(note: string): number {
  return note.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

export function getAdjustmentContext(adjustNote?: string, day?: number): AdjustmentContext {
  const note = adjustNote?.trim() ?? "";
  const lower = note.toLowerCase();

  const skipNap = /\b(no nap|skip nap|remove(?: the)? nap|without nap|no nap today)\b/.test(lower);

  const addActivity =
    !skipNap &&
    /\b(add an? activity|more activities|extra activity|more stops|add a stop)\b/.test(lower);
  const removeActivity =
    !skipNap &&
    (/\b(fewer activities|fewer stops|remove an? activity|skip an? activity|drop an? activity|less activities|one less)\b/.test(lower) ||
      (/\b(fewer|less|skip|drop)\b/.test(lower) && !/\bnap\b/.test(lower) && !addActivity));

  return {
    landmarkOffset: note ? ((adjustHash(note) + (day ?? 0) * 11) % 6) + 3 : 0,
    relaxedDay: /\b(slow|slower|relaxed|easy)\b/.test(lower) || removeActivity,
    preferOutdoor: /\b(outdoor|park|nature|beach|hike)\b/.test(lower),
    preferMuseum: /\b(museum|culture|art|science)\b/.test(lower),
    addActivity,
    removeActivity,
    skipNap,
    forceCookDinner: /\b(cook|home dinner|stay in)\b/.test(lower) ? true : null,
    forceEatOut: /\b(eat out|restaurant|dining out)\b/.test(lower) ? true : null,
    summaryNote: note,
  };
}

export function intensityForDay(plan: TripPlan, adjustment?: AdjustmentContext): IntensityConfig {
  const base = getIntensityConfig(plan);

  if (adjustment?.addActivity) {
    return {
      ...base,
      includeAfternoonActivity: true,
      includeExtraActivity: true,
      restBlocks: Math.max(1, base.restBlocks - 1),
      longBreak: false,
    };
  }

  if (adjustment?.removeActivity || adjustment?.relaxedDay) {
    return {
      ...base,
      includeAfternoonActivity: false,
      includeExtraActivity: false,
      restBlocks: Math.max(base.restBlocks, 2),
      longBreak: true,
    };
  }

  return base;
}

export function activityTitlePrefix(adjustment: AdjustmentContext, baseTitle: string): string {
  if (adjustment.preferOutdoor) {
    return `Outdoor focus: ${baseTitle}`;
  }
  if (adjustment.preferMuseum) {
    return `Culture & museums: ${baseTitle}`;
  }
  return baseTitle;
}
