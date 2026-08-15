/**
 * FAM-57 — resolve a destination city center for Places Nearby/Text Search.
 *
 * Order: wizard coords → popular/curated catalog → Place Details →
 * Places Autocomplete + Details → DEFAULT_CITY (soft fail).
 */

import { DEFAULT_CITY } from "@/config/city-pricing";
import { detectCityFromPlan } from "@/lib/city-detect";
import {
  autocompletePlacesNew,
  fetchPlaceDetailsNew,
} from "@/lib/maps/places-autocomplete-new";
import { resolvePlacesApiKey } from "@/lib/maps/get-top-activities";
import type { TripPlan } from "@/types/trip-plan";

export type DestinationCenterSource = "plan" | "catalog" | "places" | "default";

export type DestinationCenter = {
  lat: number;
  lng: number;
  source: DestinationCenterSource;
};

export type ResolveDestinationCenterOptions = {
  fetchImpl?: typeof fetch;
  env?: Partial<NodeJS.ProcessEnv>;
  now?: () => number;
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  center: DestinationCenter;
  fetchedAt: number;
};

const store = new Map<string, CacheEntry>();

export function clearDestinationCenterCache(): void {
  store.clear();
}

function hasFiniteCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

export function coordsMatchDefaultCity(lat: number, lng: number): boolean {
  return Math.abs(lat - DEFAULT_CITY.lat) < 0.01 && Math.abs(lng - DEFAULT_CITY.lng) < 0.01;
}

function cacheKey(plan: Pick<TripPlan, "destination" | "destinationPlaceId">): string {
  const placeId = plan.destinationPlaceId?.trim().toLowerCase() ?? "";
  const dest = plan.destination.trim().toLowerCase();
  return placeId ? `place:${placeId}` : `dest:${dest}`;
}

function apiKey(options: ResolveDestinationCenterOptions): string | undefined {
  return resolvePlacesApiKey(options.env ?? process.env);
}

/**
 * Destination center for Nearby/Text Search. Never throws — missing keys or
 * Places failures keep DEFAULT_CITY coords.
 */
export async function resolveDestinationCenter(
  plan: Pick<TripPlan, "destination" | "destinationPlaceId" | "destinationLat" | "destinationLng">,
  options: ResolveDestinationCenterOptions = {},
): Promise<DestinationCenter> {
  if (hasFiniteCoords(plan.destinationLat, plan.destinationLng)) {
    return {
      lat: plan.destinationLat as number,
      lng: plan.destinationLng as number,
      source: "plan",
    };
  }

  const detected = detectCityFromPlan({
    destination: plan.destination,
    destinationLat: plan.destinationLat,
    destinationLng: plan.destinationLng,
  });
  if (!coordsMatchDefaultCity(detected.lat, detected.lng)) {
    return { lat: detected.lat, lng: detected.lng, source: "catalog" };
  }

  const key = cacheKey(plan);
  const now = options.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const hit = store.get(key);
  if (hit && now - hit.fetchedAt < ttlMs) {
    console.info("[places:destination-center] cache hit", { key, source: hit.center.source });
    return hit.center;
  }

  const fromPlaces = await geocodeWithPlaces(plan, options);
  if (fromPlaces) {
    store.set(key, { center: fromPlaces, fetchedAt: now });
    console.info("[places:destination-center] cache miss", { key, source: fromPlaces.source });
    return fromPlaces;
  }

  return { lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng, source: "default" };
}

async function geocodeWithPlaces(
  plan: Pick<TripPlan, "destination" | "destinationPlaceId">,
  options: ResolveDestinationCenterOptions,
): Promise<DestinationCenter | null> {
  const key = apiKey(options);
  if (!key) return null;

  const fetchImpl = options.fetchImpl;
  const detailsOpts = { apiKey: key, fetchImpl };

  const placeId = plan.destinationPlaceId?.trim();
  if (placeId) {
    const details = await fetchPlaceDetailsNew(placeId, detailsOpts);
    if (details) {
      return { lat: details.lat, lng: details.lng, source: "places" };
    }
  }

  const dest = plan.destination.trim();
  if (!dest) return null;

  try {
    const suggestions = await autocompletePlacesNew({
      input: dest,
      includedPrimaryTypes: ["(cities)"],
      apiKey: key,
      fetchImpl,
    });
    const first = suggestions[0];
    if (!first) return null;
    const details = await fetchPlaceDetailsNew(first.placeId, detailsOpts);
    if (!details) return null;
    return { lat: details.lat, lng: details.lng, source: "places" };
  } catch {
    return null;
  }
}

/** Stamp resolved center onto a plan so stay geocode and Places search share it. */
export async function applyDestinationCenter(
  plan: TripPlan,
  options: ResolveDestinationCenterOptions = {},
): Promise<TripPlan> {
  const center = await resolveDestinationCenter(plan, options);
  if (hasFiniteCoords(plan.destinationLat, plan.destinationLng)) {
    return plan;
  }
  return {
    ...plan,
    destinationLat: center.lat,
    destinationLng: center.lng,
  };
}
