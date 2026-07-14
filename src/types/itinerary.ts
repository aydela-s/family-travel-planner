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
  durationMin: number;
  cost: number;
  provider?: string;
};

export type ItineraryDay = {
  day: number;
  date: string;
  weekday: string;
  formattedDate: string;
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
  budgetStyle: import("./trip-plan").BudgetStyle | "";
  days: ItineraryDay[];
};

/** Raw AI/demo output before enrichment */
export type RawItinerary = {
  days: {
    day: number;
    activities: {
      time: string;
      title: string;
      type: ActivityType;
      notes?: string;
    }[];
  }[];
};
