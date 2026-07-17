import { Landmark, LandmarkIntensity } from "@/config/city-pricing";
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

export type SlotPriority = "core" | "optional";

/** Ordered day intent — skeleton slot with explicit drop priority. */
export type DayIntent = {
  kind: SlotKind;
  defaultTime: string;
  priority: SlotPriority;
};

/** @deprecated Use DayIntent — kept for call-site compatibility. */
export type SkeletonSlot = DayIntent;

export type RawActivity = {
  time: string;
  title: string;
  type: ActivityType;
  notes?: string;
  slotKind?: SlotKind;
  /** Set on activity slots from the landmark catalog — drives recovery rest. */
  landmarkIntensity?: LandmarkIntensity;
};

export type DayLandmarkContext = {
  morning: Landmark;
  afternoon: Landmark;
  lunch: Landmark;
  dinner: Landmark;
  extra?: Landmark;
  dayOffset: number;
};

export type EffectivePlan = TripPlan;
