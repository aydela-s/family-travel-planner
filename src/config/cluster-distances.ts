import { TripPlan } from "@/types/trip-plan";

/**
 * Preferred same-day attraction cluster radii by getting-around mode (km).
 * FAM-78: travel-time budgets in travel-times.ts are the primary friction measure.
 * These km values stay as a comparison fallback — not a hard cutoff.
 */
export const WALKING_CLUSTER_KM = 3;
export const PUBLIC_TRANSIT_CLUSTER_KM = 5;
export const TAXI_CLUSTER_KM = 9;
export const CAR_CLUSTER_KM = 15;

/** How far behind the top score an in-cluster pick may score and still win. */
export const CLUSTER_PREFER_SCORE_MARGIN = 22;

/**
 * Preferred cluster radius for the trip's transportation mode.
 * Low walking limit tightens the preference toward the walking radius.
 */
export function clusterRadiusKm(plan: TripPlan): number {
  if (plan.transportationType === "car-rental") return CAR_CLUSTER_KM;
  if (plan.transportationType === "taxis") return TAXI_CLUSTER_KM;
  if (plan.transportationType === "walking" || plan.walkingLimit === "low") {
    return WALKING_CLUSTER_KM;
  }
  return PUBLIC_TRANSIT_CLUSTER_KM;
}
