/**
 * Short-TTL in-memory cache for Places Text Search (FAM-61).
 *
 * Upgrade path: persist rows shaped like
 *   { destination, category, fetchedAt, payload: TopActivity[] }
 * in Postgres/KV and keep this module as a process-local L1.
 */

import {
  getTopActivities,
  type GetTopActivitiesOptions,
  type TopActivity,
} from "@/lib/maps/get-top-activities";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  fetchedAt: number;
  places: TopActivity[];
};

const store = new Map<string, CacheEntry>();

export function normalizeTopActivitiesCacheKey(
  destination: string,
  category: string,
): string {
  return `${destination.trim().toLowerCase()}|${category.trim().toLowerCase()}`;
}

export function clearTopActivitiesCache(): void {
  store.clear();
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
  const key = normalizeTopActivitiesCacheKey(destination, category);
  const now = options.now?.() ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const hit = store.get(key);

  if (hit && now - hit.fetchedAt < ttlMs) {
    if (process.env.NODE_ENV === "development") {
      console.info("[places:top-activities] cache hit", { key });
    }
    return { places: hit.places, cached: true, fetchedAt: hit.fetchedAt };
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[places:top-activities] cache miss", { key });
  }

  const places = await getTopActivities(destination, category, options);
  const fetchedAt = now;
  store.set(key, { fetchedAt, places });
  return { places, cached: false, fetchedAt };
}
