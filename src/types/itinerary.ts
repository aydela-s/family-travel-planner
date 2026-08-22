export type ActivityType = "activity" | "meal" | "rest" | "nap" | "travel";

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type ActivityLocation = {
  name: string;
  lat: number;
  lng: number;
};

export type ItineraryActivity = {
  time: string;
  endTime?: string;
  title: string;
  type: ActivityType;
  timeOfDay: TimeOfDay;
  notes?: string;
  location?: ActivityLocation;
  activityCost?: number;
  /** Google Places id when sourced from Places (FAM-59/60 UI). */
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  slotKind?: import("@/lib/planning-engine/types").SlotKind;
  landmarkIntensity?: import("@/config/city-pricing").LandmarkIntensity;
  interestTags?: import("@/config/city-pricing").LandmarkInterestTag[];
  /** How well a meal matches dietary needs — must survive scheduling and render. */
  dietaryFit?: import("@/lib/planning-engine/restaurant-picker").DietaryFit;
  /** When true, a short visit is intentional rather than a compressed leftover. */
  allowShortVisit?: boolean;
  /** Taxi/transit marked complementary — $0 is then valid. */
  transportCovered?: boolean;
};

export type DayCostBreakdown = {
  food: number;
  transport: number;
  activities: number;
  total: number;
  currency: string;
  /** Informational only — Budget Style, not a target the planner tries to hit. */
  note?: string;
};

export type DayMetrics = {
  steps?: number;
  distanceKm?: number;
  fuelCost?: number;
  transportCost?: number;
  transportLabel?: string;
};

export type RouteSegment = {
  from: string;
  to: string;
  distanceKm: number;
  /** Actual in-vehicle / on-foot travel time — never includes family overhead. */
  durationMin: number;
  /** Parking, boarding, car seats, stroller — scheduled on top of durationMin. */
  bufferMin?: number;
  cost: number;
  /** Car days only — the two halves of `cost` so the number is explainable. */
  fuelCost?: number;
  parkingCost?: number;
  provider?: string;
};

export type ItineraryDay = {
  day: number;
  date: string;
  weekday: string;
  formattedDate: string;
  /** User-facing vacation title (theme polish). Internal theme ids stay off this field. */
  displayTitle?: string;
  activities: ItineraryActivity[];
  /** Informational family daily costs — food/transport/activities, no cap or target. */
  costBreakdown: DayCostBreakdown;
  accommodationTips: string[];
  costs: DayCostBreakdown;
  metrics: DayMetrics;
  routeSegments: RouteSegment[];
  mapUrl: string | null;
};

export type Itinerary = {
  destination: string;
  destinationCity: string;
  tripStartFormatted: string;
  currency: string;
  currencySymbol: string;
  pricingDisclaimer: string;
  /** Shown when the planner fell back from public transit to taxis. */
  transportNote?: string;
  budgetStyle: import("./trip-plan").BudgetStyle | "";
  days: ItineraryDay[];
  /**
   * Hard requirements the planner could not satisfy, with the alternatives it
   * considered. Deterministic input for the future "Adjust this day" flow.
   */
  conflicts?: import("@/lib/planning-engine/conflicts").PlannerConflict[];
};

/** Raw planner output before Places/maps enrichment */
export type RawItinerary = {
  days: {
    day: number;
    activities: {
      time: string;
      /** Set by the day scheduler (meal anchors / nap windows). */
      endTime?: string;
      title: string;
      type: ActivityType;
      notes?: string;
      slotKind?: import("@/lib/planning-engine/types").SlotKind;
      landmarkIntensity?: import("@/config/city-pricing").LandmarkIntensity;
      interestTags?: import("@/config/city-pricing").LandmarkInterestTag[];
    }[];
  }[];
};
