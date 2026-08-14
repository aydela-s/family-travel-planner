import type { Landmark } from "@/config/city-pricing";
import type { TravelTimeBudget } from "@/config/travel-times";
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

/** Same road-distance / duration fallback used when Google Directions is unavailable. */
export function estimateRoutedMetrics(
  straightKm: number,
  walking: boolean,
): { distanceKm: number; durationMin: number } {
  if (straightKm < 0.05) return { distanceKm: 0, durationMin: 0 };
  const roadFactor = walking ? 1.3 : 1.45;
  const distanceKm = Math.round(straightKm * roadFactor * 10) / 10;
  const durationMin = walking
    ? Math.round(distanceKm * 12)
    : Math.round(distanceKm * 3.2 + 5);
  return { distanceKm, durationMin };
}

export function estimateDurationMin(
  from: Located,
  to: Located,
  plan: Pick<TripPlan, "transportationType">,
): number {
  const walking = plan.transportationType === "walking";
  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
  return estimateRoutedMetrics(straight, walking).durationMin;
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
