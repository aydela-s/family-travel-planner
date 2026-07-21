import {
  AccommodationType,
  BudgetStyle,
  TransportationType,
  TravelStyle,
  TripPlan,
  walkingLimitFromTravelStyle,
} from "@/types/trip-plan";

export type PlanChipUpdateKey =
  | "transportation"
  | "travelStyle"
  | "budget"
  | "stay"
  | "dietary";

/** Deterministic plan patches applied from itinerary selection chips (FAM-43). */
export function updatesForPlanChip(
  key: PlanChipUpdateKey,
  value: string,
  plan: TripPlan,
): Partial<TripPlan> {
  switch (key) {
    case "transportation":
      return { transportationType: value as TransportationType };
    case "travelStyle": {
      const travelStyle = value as TravelStyle;
      return { travelStyle, walkingLimit: walkingLimitFromTravelStyle(travelStyle) };
    }
    case "budget":
      return { budgetStyle: value as BudgetStyle };
    case "stay": {
      const accommodationType = value as AccommodationType;
      if (accommodationType === "dont_know_yet") {
        return {
          accommodationType,
          stayAddress: "",
          stayPlaceId: "",
          stayLat: null,
          stayLng: null,
        };
      }
      return { accommodationType };
    }
    case "dietary": {
      const parts = plan.dietaryRestrictions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const next = parts.includes(value)
        ? parts.filter((p) => p !== value)
        : [...parts, value];
      return { dietaryRestrictions: next.join(", ") };
    }
    default:
      return {};
  }
}
