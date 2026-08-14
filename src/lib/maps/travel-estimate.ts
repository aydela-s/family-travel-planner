import type { Landmark } from "@/config/city-pricing";
import {
  directionsTravelMode,
  type DirectionsTravelMode,
  type TravelTimeBudget,
  travelDayBudget,
  travelTimeBudget,
} from "@/config/travel-times";
import type { TripPlan } from "@/types/trip-plan";

type Located = { lat: number; lng: number };

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Same road-distance / duration fallback used when Google Directions is unavailable.
 * Transit is slower than driving (waits + transfers) instead of a driving clone.
 */
export function estimateRoutedMetrics(
  straightKm: number,
  mode: DirectionsTravelMode | boolean,
): { distanceKm: number; durationMin: number } {
  if (straightKm < 0.05) return { distanceKm: 0, durationMin: 0 };
  const travelMode: DirectionsTravelMode =
    mode === true ? "walking" : mode === false ? "driving" : mode;
  const roadFactor =
    travelMode === "walking" ? 1.3 : travelMode === "transit" ? 1.55 : 1.45;
  const distanceKm = Math.round(straightKm * roadFactor * 10) / 10;
  const durationMin =
    travelMode === "walking"
      ? Math.round(distanceKm * 12)
      : travelMode === "transit"
        ? Math.round(distanceKm * 5.5 + 8)
        : Math.round(distanceKm * 3.2 + 5);
  return { distanceKm, durationMin };
}

export function estimateDurationMin(
  from: Located,
  to: Located,
  plan: Pick<TripPlan, "transportationType">,
): number {
  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
  return estimateRoutedMetrics(straight, directionsTravelMode(plan.transportationType))
    .durationMin;
}

export function stayTravelMin(
  landmark: Located,
  plan: Pick<TripPlan, "transportationType" | "stayLat" | "stayLng">,
): number | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return estimateDurationMin({ lat: plan.stayLat, lng: plan.stayLng }, landmark, plan);
}

export function travelDayLimits(plan: Pick<TripPlan, "transportationType" | "travelStyle" | "walkingLimit" | "children">): {
  preferredMin: number;
  maxMin: number;
} {
  const budget = travelDayBudget(plan);
  return { preferredMin: budget.preferredMin, maxMin: budget.softMaxMin };
}

export function fullDayTravelLimits(plan: Pick<TripPlan, "transportationType" | "travelStyle" | "walkingLimit" | "children">): {
  preferredMin: number;
  maxMin: number;
} {
  const budget = travelTimeBudget(plan);
  return { preferredMin: budget.preferredMin, maxMin: budget.softMaxMin };
}

export function isHighValueAttraction(landmark: Landmark): boolean {
  if (landmark.intensity === "high") return true;
  return landmark.interestTags.some((t) => t === "theme-parks" || t === "zoos");
}

/**
 * Soft travel-time score: bonus inside preferred, rising penalty past it.
 * High-value stops stay eligible a bit beyond preferred (not a hard cutoff).
 */
export function travelFrictionScore(
  durationMin: number,
  budget: TravelTimeBudget,
  opts?: { highValue?: boolean },
): number {
  const highValue = Boolean(opts?.highValue);
  if (durationMin <= 0) return 22;
  if (durationMin <= budget.preferredMin) {
    return 24 - (durationMin / Math.max(1, budget.preferredMin)) * 8;
  }

  const span = Math.max(1, budget.softMaxMin - budget.preferredMin);
  const overPreferred = durationMin - budget.preferredMin;

  if (durationMin <= budget.softMaxMin) {
    const t = overPreferred / span;
    if (highValue) return 6 - t * 12;
    return 8 - t * 22;
  }

  const overSoft = durationMin - budget.softMaxMin;
  if (highValue && overSoft <= 15) {
    return -12 - overSoft * 0.6;
  }
  return -12 - overSoft * 1.5;
}
