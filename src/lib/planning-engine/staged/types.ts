import type { LandmarkInterestTag } from "@/config/city-pricing";
import type { NapEntry, BudgetStyle, TravelStyle, TransportationType } from "@/types/trip-plan";

/** Blueprint schema version — bump when fields change incompatibly. */
export const TRIP_BLUEPRINT_VERSION = 1 as const;

export type PlannerEngine = "score" | "staged";

/** Day-level paid vs free intent from themes + budget rules (not price-third pools). */
export type DayBudgetIntent = "paid" | "free" | "either";

/** Structural role before/with theme assignment. */
export type DayRole = "arrival" | "full" | "departure" | "recovery";

/**
 * Internal theme ids — not user-facing day titles.
 * Display titles (e.g. "Ocean Adventure Day") come later via AI polish / copy layer.
 */
export type ThemeId =
  | "arrival"
  | "departure"
  | "beach"
  | "play_indoor"
  | "playgrounds"
  | "interactive"
  | "animals"
  | "entertainment"
  | "theme_park"
  | "nature"
  | "nature_parks"
  | "food_market"
  | "shopping"
  | "history"
  | "scenic"
  | "mixed_family"
  | "recovery";

export type MealFormality = "picnic_or_casual" | "named_casual" | "named_sit_down";

export type MealSlotKind = "breakfast" | "lunch" | "dinner";

/**
 * Compiled planning rules — the only budget/pace interpretation later stages should read.
 * Produced by TripStrategyBuilder; not a dollar budget.
 */
export type PlanningRules = {
  budgetStyle: BudgetStyle;
  pace: TravelStyle;

  /** Target share of days whose anchor should be paid (0–1). */
  paidDayRatio: number;
  /** Soft max paid activity stops per day (anchor counts). */
  maxPaidAnchorsPerDay: number;
  /** Soft target for premium/paid experiences across the whole trip. */
  premiumExperienceTarget: number;

  /** Which meals prefer a named restaurant. */
  namedRestaurantMeals: MealSlotKind[];
  /** Default lunch formality when not overridden by nap/kitchen. */
  lunchFormality: MealFormality;
  dinnerFormality: MealFormality;
  /** Prefer cook-at-home dinner on odd kitchen days (false for splurge). */
  preferCookNights: boolean;
  /** Prefer picnic / packed lunch when accommodation allows. */
  preferPicnicLunch: boolean;

  /**
   * Soft transport preference after user choice + city feasibility.
   * Does not override hard transit-quality fallbacks.
   */
  transportPreference: TransportationType;
  /** Prefer fewer hops / more convenience (taxis, shorter walks). */
  convenienceLevel: "low" | "medium" | "high";

  /** Pace capacity consumed by Anchor + Support selectors. */
  capacity: {
    maxActivitiesPerDay: number;
    maxSupportStops: number;
    preferHalfDayAnchor: boolean;
    includeMiddayRest: boolean;
    activityDurationMin: number;
    restDurationMin: number;
  };

  napWindows: NapEntry[];
};

export type DayTheme = {
  /** Internal id — not shown to users as the day title. */
  id: ThemeId | string;
  /** Short internal label for debugging / logs. */
  label: string;
  primaryTags: LandmarkInterestTag[];
  secondaryTags: LandmarkInterestTag[];
  /** Preferred experience types for Anchor/Support (soft). */
  preferredExperienceTypes: LandmarkInterestTag[];
};

/** Goals later stages must try to satisfy for this day. */
export type DayGoal =
  | { type: "low_friction" }
  | { type: "easy_exit" }
  | { type: "keep_energy_low" }
  | { type: "prefer_near_stay_or_flexible_outdoor"; maxKm: number }
  | { type: "cover_experience"; tag: LandmarkInterestTag }
  | { type: "dedicated_experience"; tag: LandmarkInterestTag }
  | { type: "half_day_anchor" }
  | { type: "honor_nap_windows" }
  | { type: "prefer_indoor" }
  | { type: "prefer_outdoor" }
  | {
      type: "include_older_appeal";
      options: Array<"scenic" | "food" | "cultural" | "unique">;
    };

/**
 * Soft restrictions for Anchor/Support — not hard forbids.
 * Selectors rank within candidates; Validation may flag violations.
 */
export type DayConstraint =
  | { type: "anchor_primary_tags"; tags: LandmarkInterestTag[]; mode: "any" | "all" }
  | { type: "discourage_anchor_tags"; tags: LandmarkInterestTag[] }
  | { type: "discourage_indoor_paid_anchor" }
  | { type: "avoid_high_risk_time_sensitive_anchor" }
  | { type: "avoid_far_attractions"; maxKm: number }
  | { type: "avoid_fixed_time_experiences" }
  | { type: "avoid_paid_tickets" }
  | { type: "max_activities"; n: number }
  | { type: "prefer_free_anchor" }
  | { type: "prefer_paid_anchor" }
  | { type: "require_half_day_window" }
  | { type: "prefer_recovery_outdoor" }
  | { type: "prefer_shoreline_beach_anchor" }
  | { type: "prefer_low_walking" };

export type CommittedStop = {
  landmarkName: string;
  placeId?: string;
  role: "anchor" | "support";
  interestTags: LandmarkInterestTag[];
  /** True when adultPrice > 0 (or known paid). */
  isPaid: boolean;
};

export type MealIntent = {
  slot: MealSlotKind;
  mode: "named_restaurant" | "on_site" | "picnic" | "takeout_at_stay" | "cook_at_home" | "bakery_casual";
  restaurantName?: string;
  nearLandmarkName?: string;
  notes?: string;
};

export type DayBlueprint = {
  dayIndex: number;
  date: string;
  role: DayRole;
  theme: DayTheme;
  /** What this day is trying to achieve — selectors must respect. */
  goals: DayGoal[];
  /** Soft/hard filters for selectors — validation checks compliance. */
  constraints: DayConstraint[];
  dayBudgetIntent: DayBudgetIntent;
  capacity: PlanningRules["capacity"];
  anchor?: CommittedStop;
  support: CommittedStop[];
  meals: MealIntent[];
};

export type TripLedger = {
  landmarkNames: string[];
  restaurantNames: string[];
  satisfiedInterestTags: LandmarkInterestTag[];
};

/**
 * Trip-level target vs completed experiences.
 * Updated as anchors/support commit; Theme/Anchor stages read remaining gaps.
 */
export type ExperienceCoverageItem = {
  /** Stable key — usually the primary interest tag. */
  key: string;
  tag: LandmarkInterestTag;
  /** Wizard label when derived from interests. */
  label?: string;
  target: number;
  completed: number;
  source: "interest" | "budget_premium" | "destination_highlight";
};

export type ExperienceCoverage = {
  items: ExperienceCoverageItem[];
};

export type TripBlueprint = {
  blueprintVersion: typeof TRIP_BLUEPRINT_VERSION;
  strategy: {
    budgetStyle: BudgetStyle;
    pace: TravelStyle;
    transitMode: TransportationType;
    destination: string;
    dayCount: number;
  };
  rules: PlanningRules;
  /** @deprecated Prefer experienceCoverage — kept during migration. */
  interestQuota: Array<{ tag: LandmarkInterestTag; target: number; scheduled: number }>;
  experienceCoverage: ExperienceCoverage;
  days: DayBlueprint[];
  ledger: TripLedger;
};

export type ValidationViolation = {
  code: string;
  message: string;
  /** 1-based day index; omit for trip-level issues. */
  day?: number;
  repairHint?:
    | "regenerate_day"
    | "regenerate_anchor"
    | "regenerate_support"
    | "regenerate_meals"
    | "regenerate_schedule";
};
