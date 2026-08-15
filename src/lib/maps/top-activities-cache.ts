/**
 * Short-TTL in-memory cache for Places Text Search (FAM-61).
 *
 * Upgrade path: persist rows shaped like
 *   { destination, category, fetchedAt, payload: TopActivity[] }
 * in Postgres/KV and keep this module as a process-local L1.
 */

import {
  DEFAULT_PLACES_RADIUS_METERS,
  getTopActivities,
  type GetTopActivitiesOptions,
  type PlacesLocationBias,
  type TopActivity,
} from "@/lib/maps/get-top-activities";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
/** Soft-launch cap so one plan cannot fan out unbounded Places calls. */
export const MAX_CONCURRENT_PLACES_FETCHES = 3;

type CacheEntry = {
  fetchedAt: number;
  places: TopActivity[];
};

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<GetOrFetchTopActivitiesResult>>();

let activeFetches = 0;
const waiters: Array<() => void> = [];

async function withPlacesConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (activeFetches >= MAX_CONCURRENT_PLACES_FETCHES) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  activeFetches += 1;
  try {
    return await fn();
  } finally {
    activeFetches -= 1;
    waiters.shift()?.();
  }
}

export function normalizeTopActivitiesCacheKey(
  destination: string,
  category: string,
  location?: PlacesLocationBias,
): string {
  const dest = destination.trim().toLowerCase();
  const cat = category.trim().toLowerCase();
  if (
    location &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  ) {
    const radius = location.radiusMeters ?? DEFAULT_PLACES_RADIUS_METERS;
    return `${dest}|${cat}|${location.lat.toFixed(3)}|${location.lng.toFixed(3)}|${radius}`;
  }
  return `${dest}|${cat}`;
}

export function clearTopActivitiesCache(): void {
  store.clear();
  inflight.clear();
}

export type GetOrFetchTopActivitiesResult = {
  places: TopActivity[];
  cached: boolean;
  fetchedAt: number;
};

export type GetOrFetchOptions = GetTopActivitiesOptions & {
  ttlMs?: number;
  now?: () => number;
};

export async function getOrFetchTopActivities(
  destination: string,
  category: string,
  options: GetOrFetchOptions = {},
): Promise<GetOrFetchTopActivitiesResult> {
  const key = normalizeTopActivitiesCacheKey(destination, category, options.location);
  const now = options.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const hit = store.get(key);

  if (hit && now - hit.fetchedAt < ttlMs) {
    console.info("[places:top-activities] cache hit", { key });
    return { places: hit.places, cached: true, fetchedAt: hit.fetchedAt };
  }

  const pending = inflight.get(key);
  if (pending) {
    console.info("[places:top-activities] cache coalesce", { key });
    return pending;
  }

  console.info("[places:top-activities] cache miss", { key });

  const request = withPlacesConcurrency(async () => {
    const places = await getTopActivities(destination, category, options);
    const fetchedAt = options.now?.() ?? Date.now();
    store.set(key, { fetchedAt, places });
    return { places, cached: false, fetchedAt };
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}
