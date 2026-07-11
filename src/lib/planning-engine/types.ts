import { CityConfig } from "@/config/city-pricing";
import { AdjustActionId } from "@/lib/planning-engine/adjust-types";
import { ActivityType, ItineraryDay, RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type ValidationIssue = {
  code: string;
  message: string;
};
export type PlanOptions = {
  relaxed?: boolean;
  adjustDay?: number;
  adjustAction?: AdjustActionId;
  adjustNote?: string;
  existingItinerary?: RawItinerary;
  enrichedDay?: ItineraryDay;
};

/** Ordered slot in a deterministic day skeleton — filled after structure is built */
export type SlotKind =
  | "breakfast"
  | "morning_activity"
  | "lunch"
  | "midday_rest"
  | "afternoon_rest"
  | "afternoon_activity"
  | "extra_activity"
  | "calm_activity"
  | "grocery"
  | "return_home"
  | "evening_rest"
  | "dinner";

export type SkeletonSlot = {
  kind: SlotKind;
  defaultTime: string;
};

export type RawActivity = {
  time: string;
  title: string;
  type: ActivityType;
  notes?: string;
};

export type DayLandmarkContext = {
  morning: CityConfig["landmarks"][0];
  afternoon: CityConfig["landmarks"][0];
  lunch: CityConfig["landmarks"][0];
  dinner: CityConfig["landmarks"][0];
  extra?: CityConfig["landmarks"][0];
  budgetLabel: string;
  dayOffset: number;
};

export type EffectivePlan = TripPlan;
