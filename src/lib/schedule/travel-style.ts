import { TripPlan, TravelStyle } from "@/types/trip-plan";

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
