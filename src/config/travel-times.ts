import type { TransportationType, TripPlan } from "@/types/trip-plan";

/**
 * FAM-78 — preferred and soft-max one-way travel times by getting-around mode.
 * Distance radii in cluster-distances.ts stay as a comparison fallback.
 */
export type TravelTimeBudget = {
  preferredMin: number;
  softMaxMin: number;
};

export const TRAVEL_TIME_BY_MODE: Record<TransportationType, TravelTimeBudget> = {
  walking: { preferredMin: 15, softMaxMin: 25 },
  "public-transportation": { preferredMin: 25, softMaxMin: 40 },
  taxis: { preferredMin: 30, softMaxMin: 40 },
  "car-rental": { preferredMin: 45, softMaxMin: 60 },
};

/** Consecutive stops closer than this are treated as walkable — no taxi fare. */
export const WALKABLE_TAXI_KM = 0.4;

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
 * Mode-specific travel-time budget, adjusted for young kids, pace, and walking limit.
 */
export function travelTimeBudget(plan: TravelTimePlan): TravelTimeBudget {
  const mode = (plan.transportationType || "public-transportation") as TransportationType;
  const base = TRAVEL_TIME_BY_MODE[mode] ?? TRAVEL_TIME_BY_MODE["public-transportation"];
  let preferredMin = base.preferredMin;
  let softMaxMin = base.softMaxMin;

  const youngest = plan.children.length > 0 ? Math.min(...plan.children) : null;
  if (youngest !== null && youngest <= 3) {
    preferredMin -= 8;
    softMaxMin -= 10;
  } else if (youngest !== null && youngest <= 7) {
    preferredMin -= 4;
    softMaxMin -= 5;
  }

  if (plan.travelStyle === "packed") {
    preferredMin += 10;
    softMaxMin += 10;
  } else if (plan.travelStyle === "relaxed") {
    preferredMin -= 8;
    softMaxMin -= 8;
  }

  if (plan.walkingLimit === "low" && mode !== "car-rental") {
    preferredMin -= 5;
    softMaxMin -= 5;
  }

  preferredMin = Math.max(10, preferredMin);
  softMaxMin = Math.max(preferredMin + 8, softMaxMin);
  return { preferredMin, softMaxMin };
}

/**
 * Arrival/departure stay inside the preferred full-day window, not the
 * high-value soft max (Torrey Pines from downtown is a full-day hop).
 */
export function travelDayBudget(plan: TravelTimePlan): TravelTimeBudget {
  const full = travelTimeBudget(plan);
  return {
    preferredMin: Math.max(10, Math.round(full.preferredMin * 0.7)),
    softMaxMin: full.preferredMin,
  };
}
