import { TripPlan } from "@/types/trip-plan";

export type AdjustActionId =
  | "fewer_activities"
  | "add_activity"
  | "more_outdoor_time"
  | "replace_main_activity"
  | "cook_dinner_tonight"
  | "eat_out_tonight"
  | "less_walking"
  | "more_walking"
  | "more_playground_time"
  | "add_evening_activity";

export type AdjustActionOption = {
  id: AdjustActionId;
  label: string;
  enabled: boolean;
  reason?: string;
};

export type DayAdjustContext = {
  dayNumber: number;
  activityCount: number;
  hasMorningActivity: boolean;
  isCookNight: boolean;
  hasGroceryTonight: boolean;
  isEatOutNight: boolean;
  hasKitchen: boolean;
  transportationType: TripPlan["transportationType"];
  walkingLimit: TripPlan["walkingLimit"];
  daySteps: number;
  distanceKm: number;
  youngestChild: number | null;
  oldestChild: number | null;
  eveningGapMin: number;
  allOutdoorActivities: boolean;
};

export type AdjustApplyResult = {
  applied: boolean;
  message?: string;
  activities: { time: string; title: string; type: import("@/types/itinerary").ActivityType; notes?: string }[];
  planOverrides?: Partial<TripPlan>;
};

export const ADJUST_ACTION_LABELS: Record<AdjustActionId, string> = {
  fewer_activities: "Fewer activities",
  add_activity: "Add an activity",
  more_outdoor_time: "More outdoor time",
  replace_main_activity: "Replace main activity",
  cook_dinner_tonight: "Cook dinner tonight",
  eat_out_tonight: "Eat out tonight",
  less_walking: "Less walking",
  more_walking: "More walking",
  more_playground_time: "More playground time",
  add_evening_activity: "Add an evening activity",
};
