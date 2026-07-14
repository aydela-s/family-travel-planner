export type TravelStyle = "relaxed" | "balanced" | "packed";

export type BudgetStyle = "save" | "balanced" | "splurge";

export type WalkingLimit = "low" | "medium" | "high";

export type TransportationType =
  | "walking"
  | "car-rental"
  | "taxis"
  | "public-transportation";

export type AccommodationType =
  | "hotel_breakfast_included"
  | "hotel_no_breakfast"
  | "airbnb_with_kitchen"
  | "airbnb_no_kitchen"
  | "staying_with_family_or_friends"
  | "";

export type TripPlan = {
  destination: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number[];
  travelStyle: TravelStyle | "";
  walkingLimit: WalkingLimit | "";
  transportationType: TransportationType | "";
  accommodationType: AccommodationType;
  dietaryRestrictions: string;
  napSchedule: string;
  budgetStyle: BudgetStyle | "";
  interests: string[];
};

export const initialTripPlan: TripPlan = {
  destination: "",
  startDate: "",
  endDate: "",
  adults: 2,
  children: [],
  travelStyle: "",
  walkingLimit: "",
  transportationType: "",
  accommodationType: "",
  dietaryRestrictions: "",
  napSchedule: "",
  budgetStyle: "",
  interests: [],
};

export type StepProps = {
  formData: TripPlan;
  updateFormData: (updates: Partial<TripPlan>) => void;
};

/** Infer walking tolerance from travel pace when the user no longer picks it separately */
export function walkingLimitFromTravelStyle(style: TravelStyle): WalkingLimit {
  switch (style) {
    case "relaxed":
      return "low";
    case "packed":
      return "high";
    default:
      return "medium";
  }
}
