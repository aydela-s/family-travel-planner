import { familyTravelBufferMin } from "@/lib/schedule/travel-buffer";
import type { TransportationType, TripPlan } from "@/types/trip-plan";

/**
 * FAM-78 — preferred and soft-max one-way travel times by getting-around mode.
 * Distance radii in cluster-distances.ts stay as a comparison fallback.
 */
export type TravelTimeBudget = {
  preferredMin: number;
  softMaxMin: number;
};

/**
 * How far the family is willing to *travel* per hop — pure driving / transit /
 * walking time, the number a map app would quote. Parking, boarding and
 * kid-wrangling are added separately by travelTimeBudget below.
 */
export const TRAVEL_TIME_BY_MODE: Record<TransportationType, TravelTimeBudget> = {
  walking: { preferredMin: 15, softMaxMin: 25 },
  "public-transportation": { preferredMin: 25, softMaxMin: 40 },
  taxis: { preferredMin: 30, softMaxMin: 40 },
  "car-rental": { preferredMin: 45, softMaxMin: 60 },
};

/** Consecutive stops closer than this are treated as walkable — no taxi fare. */
export const WALKABLE_TAXI_KM = 1.2;

/** Google Directions `mode` for a trip transportation type. */
export type DirectionsTravelMode = "walking" | "driving" | "transit";

export function directionsTravelMode(
  transportType: string | undefined,
): DirectionsTravelMode {
  if (transportType === "walking") return "walking";
  if (transportType === "public-transportation") return "transit";
  return "driving";
}

type TravelTimePlan = Pick<
  TripPlan,
  "transportationType" | "travelStyle" | "walkingLimit" | "children"
>;

/**
 * Mode-specific door-to-door travel budget, adjusted for young kids, pace, and
 * walking limit. Age/pace factors scale the *travel* allowance; the family
 * buffer is then added, so a toddler shortens the drive rather than the parking.
 */
export function travelTimeBudget(plan: TravelTimePlan): TravelTimeBudget {
  const mode = (plan.transportationType || "public-transportation") as TransportationType;
  const base = TRAVEL_TIME_BY_MODE[mode] ?? TRAVEL_TIME_BY_MODE["public-transportation"];

  let factor = 1;
  const youngest = plan.children.length > 0 ? Math.min(...plan.children) : null;
  if (youngest !== null && youngest <= 3) factor *= 0.78;
  else if (youngest !== null && youngest <= 7) factor *= 0.9;

  if (plan.travelStyle === "packed") factor *= 1.22;
  else if (plan.travelStyle === "relaxed") factor *= 0.82;

  if (plan.walkingLimit === "low" && mode !== "car-rental") factor *= 0.89;

  const buffer = familyTravelBufferMin(plan);
  const preferredMin = Math.max(6, Math.round(base.preferredMin * factor)) + buffer;
  const softMaxMin = Math.max(
    preferredMin + 5,
    Math.round(base.softMaxMin * factor) + buffer,
  );
  return { preferredMin, softMaxMin };
}

/**
 * Arrival/departure stay inside the preferred full-day window, not the
 * high-value soft max (Torrey Pines from downtown is a full-day hop).
 */
export function travelDayBudget(plan: TravelTimePlan): TravelTimeBudget {
  const full = travelTimeBudget(plan);
  const buffer = familyTravelBufferMin(plan);
  // Shrink the travel allowance, not the fixed parking/boarding overhead.
  const travelAllowance = Math.max(0, full.preferredMin - buffer);
  return {
    preferredMin: Math.max(6, Math.round(travelAllowance * 0.7)) + buffer,
    softMaxMin: full.preferredMin,
  };
}
