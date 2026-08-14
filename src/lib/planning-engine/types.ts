import { CityConfig, Landmark, LandmarkIntensity } from "@/config/city-pricing";
import { AdjustActionId } from "@/lib/planning-engine/adjust-types";
import type { PlannerEngine, TripBlueprint } from "@/lib/planning-engine/staged/types";
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
  /** Prefer curated or Places-built city over detectCity (FAM-59). */
  cityOverride?: CityConfig;
  /**
   * Which planner engine to run. Defaults via PLANNER_ENGINE env, then "staged".
   * Pass "score" (or PLANNER_ENGINE=score) for the quarantined legacy rollback path.
   */
  plannerEngine?: PlannerEngine;
};

export type { PlannerEngine, TripBlueprint };

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
  /** Set by the day scheduler (meal anchors / nap windows). */
  endTime?: string;
  title: string;
  type: ActivityType;
  notes?: string;
  slotKind?: SlotKind;
  /** Set on activity slots from the landmark catalog — drives recovery rest. */
  landmarkIntensity?: LandmarkIntensity;
  /** Landmark interest tags — category defaults in docs/interest-categories.md. */
  interestTags?: import("@/config/city-pricing").LandmarkInterestTag[];
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
