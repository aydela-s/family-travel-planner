import { detectCity } from "@/lib/city-detect";
import { geocodeStay } from "@/lib/places-geocode";
import { hasStayHome, isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { TripPlan } from "@/types/trip-plan";

export type ResolvedStay = {
  stayAddress: string;
  stayPlaceId: string;
  stayLat: number;
  stayLng: number;
};

function cityCenterStay(plan: TripPlan): ResolvedStay {
  const city = detectCity(plan.destination);
  return {
    stayAddress: `${city.name} city center`,
    stayPlaceId: "",
    stayLat: city.lat,
    stayLng: city.lng,
  };
}

/** Apply geocode result onto a plan (shared by wizard + generate API). */
export async function resolveStayOntoPlan(plan: TripPlan): Promise<TripPlan> {
  if (isStayNotBookedYet(plan)) {
    const center = cityCenterStay(plan);
    return { ...plan, ...center };
  }

  const typed = (plan.stayAddress ?? "").trim();
  if (!typed) return plan;
  if (hasStayHome(plan)) return plan;

  const city = detectCity(plan.destination);
  const resolved = await geocodeStay({
    query: typed,
    city: city.name,
    lat: city.lat,
    lng: city.lng,
  });

  return {
    ...plan,
    stayAddress: resolved.address || typed,
    stayPlaceId: resolved.placeId,
    stayLat: resolved.lat,
    stayLng: resolved.lng,
  };
}

/**
 * Browser helper: resolve free-text stay via the geocode API.
 * Unknown stay → city center. Otherwise falls back to city center if Google can't pinpoint.
 */
export async function resolveStayFromText(plan: TripPlan): Promise<ResolvedStay | null> {
  if (isStayNotBookedYet(plan)) {
    return cityCenterStay(plan);
  }

  const typed = (plan.stayAddress ?? "").trim();
  if (!typed) return null;

  if (hasStayHome(plan)) {
    return {
      stayAddress: typed,
      stayPlaceId: plan.stayPlaceId ?? "",
      stayLat: plan.stayLat as number,
      stayLng: plan.stayLng as number,
    };
  }

  const city = detectCity(plan.destination);
  const params = new URLSearchParams({
    q: typed,
    city: city.name,
    lat: String(city.lat),
    lng: String(city.lng),
  });

  try {
    const res = await fetch(`/api/places/geocode?${params}`);
    const data = await res.json();
    if (res.ok && typeof data.lat === "number" && typeof data.lng === "number") {
      return {
        stayAddress: typeof data.address === "string" && data.address.trim() ? data.address : typed,
        stayPlaceId: typeof data.placeId === "string" ? data.placeId : "",
        stayLat: data.lat,
        stayLng: data.lng,
      };
    }
  } catch {
    // city fallback below
  }

  return {
    stayAddress: typed,
    stayPlaceId: "",
    stayLat: city.lat,
    stayLng: city.lng,
  };
}
