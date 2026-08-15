import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { TripPlan, TravelStyle } from "@/types/trip-plan";

/** When packed drops to fewer stops, stretch remaining activities to this length. */
export const PACKED_LONGER_ACTIVITY_MIN = 120;
/** Shortest packed extra stop we'll still schedule rather than dropping it. */
export const PACKED_EXTRA_MIN_DURATION_MIN = 45;

export type IntensityConfig = {
  style: TravelStyle | "";
  maxActivities: number;
  includeAfternoonActivity: boolean;
  includeExtraActivity: boolean;
  restBlocks: number;
  restDurationMin: number;
  activityDurationMin: number;
  longBreak: boolean;
};

/**
 * Real family trips with a midday nap (e.g. toddler 12:30–2 at home) rarely do
 * two outings the same day. Balanced + nap + young kids → one hero activity.
 * Packed stays denser; relaxed was already one stop.
 */
export function prefersSingleActivityDays(plan: TripPlan): boolean {
  if ((plan.naps?.length ?? 0) === 0) return false;
  const profile = getFamilyAgeProfile(plan);
  return profile.hasToddler || profile.hasYoungChild;
}

export function getIntensityConfig(plan: TripPlan): IntensityConfig {
  const style = plan.travelStyle || "balanced";

  if (style === "relaxed") {
    return {
      style,
      maxActivities: 1,
      includeAfternoonActivity: false,
      includeExtraActivity: false,
      restBlocks: 2,
      restDurationMin: 50,
      activityDurationMin: 105,
      longBreak: true,
    };
  }

  if (style === "packed") {
    // Packed must always schedule more activities than balanced, for every
    // family — age-appropriateness of the extra stop is handled by
    // pickLandmarkForFamily's age scoring, not by dropping the slot.
    // When the optional extra is skipped at schedule time (naps / dinner),
    // remaining activities lengthen to PACKED_LONGER_ACTIVITY_MIN.
    return {
      style,
      maxActivities: 3,
      includeAfternoonActivity: true,
      includeExtraActivity: true,
      restBlocks: 1,
      restDurationMin: 25,
      activityDurationMin: 75,
      longBreak: false,
    };
  }

  if (prefersSingleActivityDays(plan)) {
    return {
      style: "balanced",
      maxActivities: 1,
      includeAfternoonActivity: true,
      includeExtraActivity: false,
      restBlocks: 1,
      restDurationMin: 35,
      activityDurationMin: 105,
      longBreak: false,
    };
  }

  return {
    style: "balanced",
    maxActivities: 2,
    includeAfternoonActivity: true,
    includeExtraActivity: false,
    restBlocks: 1,
    restDurationMin: 35,
    activityDurationMin: 90,
    longBreak: false,
  };
}

export function isRelaxedDay(plan: TripPlan): boolean {
  return plan.travelStyle === "relaxed";
}
