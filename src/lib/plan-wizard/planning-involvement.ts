import { detectCity } from "@/lib/city-detect";
import { isPublicTransitSelectable } from "@/lib/planning-engine/transit-mode";
import {
  type TripPlan,
  walkingLimitFromTravelStyle,
} from "@/types/trip-plan";

/** Broad starter interests when the user skips the Interests step. */
export const MINIMAL_MODE_DEFAULT_INTERESTS = [
  "Parks & Gardens",
  "Museums & Art",
] as const;

/**
 * Fill preference fields so skipped wizard steps stay complete under the gate.
 * Idempotent — keeps any values the user already chose.
 */
export function applyMinimalPlanDefaults(plan: TripPlan): TripPlan {
  const city = detectCity(plan.destination);
  const transportationType =
    plan.transportationType ||
    (isPublicTransitSelectable(city) ? "public-transportation" : "taxis");
  const travelStyle = plan.travelStyle || "balanced";
  const accommodationType = plan.accommodationType || "dont_know_yet";
  const stayUnknown = accommodationType === "dont_know_yet";

  return {
    ...plan,
    planningInvolvementMode: "minimal",
    travelStyle,
    walkingLimit: plan.walkingLimit || walkingLimitFromTravelStyle(travelStyle),
    budgetStyle: plan.budgetStyle || "balanced",
    accommodationType,
    ...(stayUnknown
      ? {
          stayAddress: "",
          stayPlaceId: "",
          stayLat: null as number | null,
          stayLng: null as number | null,
        }
      : {}),
    transportationType,
    interests:
      plan.interests.length > 0
        ? plan.interests
        : [...MINIMAL_MODE_DEFAULT_INTERESTS],
  };
}

/** Clear auto-filled prefs when switching back to the full wizard. */
export function clearMinimalPlanDefaults(plan: TripPlan): TripPlan {
  return {
    ...plan,
    planningInvolvementMode: "detailed",
    travelStyle: "",
    walkingLimit: "",
    budgetStyle: "",
    accommodationType: "",
    stayAddress: "",
    stayPlaceId: "",
    stayLat: null,
    stayLng: null,
    transportationType: "",
    interests: [],
  };
}
