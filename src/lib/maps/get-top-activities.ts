/**
 * Server-side only — never import into a client component.
 *
 * Places API (New) Text Search → family-friendly filter + rank (FAM-58 / FAM-60).
 */

import {
  familyPlaceScore,
  isBlockedFamilyPlace,
  placeKindForCategory,
  type FamilyPlaceKind,
} from "@/lib/maps/family-friendly-places";
import {
  hoursByWeekdayFromRegularOpeningHours,
  type PlacesRegularOpeningHours,
} from "@/lib/maps/places-hours";
import {
  isDestinationShoppingPlace,
  isShoppingSearchCategory,
  shoppingPlaceScoreBoost,
} from "@/lib/maps/shopping-places";
import type { HoursByWeekday } from "@/config/city-pricing";

export type TopActivity = {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  /** e.g. "PRICE_LEVEL_MODERATE" */
  priceLevel: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  photoRef: string | null;
  score: number;
  /** Places types used for family filter / ranking (FAM-60). */
  types: string[];
  primaryType: string | null;
  /** Official website when Places returns one — shopping quality gate. */
  websiteUri: string | null;
  /**
   * Weekday hours from Text Search `regularOpeningHours` (FAM-66).
   * Null/undefined when Places omitted hours — fall back to tag defaults.
   */
  hoursByWeekday: HoursByWeekday | null;
};

/** Raw place shape from Places API (New) searchText (field-masked). */
export type PlacesSearchTextPlace = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  photos?: Array<{ name?: string }>;
  types?: string[];
  primaryType?: string;
  websiteUri?: string;
  regularOpeningHours?: PlacesRegularOpeningHours;
};

export const MIN_RATING = 4.3;
export const MIN_REVIEWS = 150;
export const MAX_RESULTS = 15;
export const MAX_ATTRACTION_RESULTS = 15;
export const MAX_RESTAURANT_RESULTS = 12;

export class PlacesApiKeyMissingError extends Error {
  constructor() {
    super("GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY) is not set");
    this.name = "PlacesApiKeyMissingError";
  }
}

export class PlacesApiError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`Places API error (${status}): ${body}`);
    this.name = "PlacesApiError";
    this.status = status;
  }
}

/** Prefer Places-specific key; fall back to the Maps key already used elsewhere. */
export function resolvePlacesApiKey(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): string | undefined {
  const places = env.GOOGLE_PLACES_API_KEY?.trim();
  if (places) return places;
  const maps = env.GOOGLE_MAPS_API_KEY?.trim();
  return maps || undefined;
}

export function activityScore(rating: number, reviewCount: number): number {
  // Rewards high rating but weights review volume so a 5.0 with 3 reviews
  // doesn't beat a 4.6 with 3,000 reviews.
  return rating * Math.log(reviewCount + 1);
}

export function defaultMaxResultsForKind(kind: FamilyPlaceKind): number {
  return kind === "restaurant" ? MAX_RESTAURANT_RESULTS : MAX_ATTRACTION_RESULTS;
}

export type RankTopActivitiesOptions = {
  maxResults?: number;
  /** Attraction vs restaurant preferred-type boosts (FAM-60). */
  kind?: FamilyPlaceKind;
  /** Original search category — shopping searches apply mall/outlet quality gates. */
  category?: string;
};

/** Pure filter + rank — unit-tested without network. */
export function rankTopActivitiesFromPlaces(
  places: PlacesSearchTextPlace[],
  maxResultsOrOptions: number | RankTopActivitiesOptions = MAX_RESULTS,
): TopActivity[] {
  const options: RankTopActivitiesOptions =
    typeof maxResultsOrOptions === "number"
      ? { maxResults: maxResultsOrOptions }
      : maxResultsOrOptions;
  const kind = options.kind ?? "attraction";
  const maxResults = options.maxResults ?? defaultMaxResultsForKind(kind);
  const shoppingCategory = isShoppingSearchCategory(options.category ?? "");

  return places
    .filter(
      (p): p is PlacesSearchTextPlace & { id: string; rating: number; userRatingCount: number } =>
        typeof p.id === "string" &&
        typeof p.rating === "number" &&
        p.rating >= MIN_RATING &&
        typeof p.userRatingCount === "number" &&
        p.userRatingCount >= MIN_REVIEWS,
    )
    .filter((p) => {
      const name = p.displayName?.text ?? "Unknown";
      return !isBlockedFamilyPlace({
        name,
        types: p.types,
        primaryType: p.primaryType,
      });
    })
    .filter((p) => {
      if (!shoppingCategory) return true;
      return isDestinationShoppingPlace({
        name: p.displayName?.text ?? "Unknown",
        types: p.types,
        primaryType: p.primaryType,
        websiteUri: p.websiteUri,
      });
    })
    .map((p) => {
      const name = p.displayName?.text ?? "Unknown";
      const types = [...(p.types ?? [])];
      if (p.primaryType && !types.includes(p.primaryType)) {
        types.unshift(p.primaryType);
      }
      const websiteUri = p.websiteUri?.trim() || null;
      const base = familyPlaceScore({
        rating: p.rating,
        reviewCount: p.userRatingCount,
        types: p.types,
        primaryType: p.primaryType,
        kind,
      });
      const shopBoost = shoppingCategory
        ? shoppingPlaceScoreBoost({
            name,
            types: p.types,
            primaryType: p.primaryType,
            websiteUri,
          })
        : 0;
      return {
        id: p.id,
        name,
        rating: p.rating,
        reviewCount: p.userRatingCount,
        priceLevel: p.priceLevel ?? null,
        address: p.formattedAddress ?? null,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        photoRef: p.photos?.[0]?.name ?? null,
        types,
        primaryType: p.primaryType ?? null,
        websiteUri,
        hoursByWeekday: hoursByWeekdayFromRegularOpeningHours(p.regularOpeningHours) ?? null,
        score: base + shopBoost,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .slice(0, maxResults);
}

export const DEFAULT_PLACES_RADIUS_METERS = 35_000;

export type PlacesLocationBias = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export type GetTopActivitiesOptions = {
  maxResults?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  env?: Partial<NodeJS.ProcessEnv>;
  /** City center + radius so Text Search stays near the destination (FAM-57/58). */
  location?: PlacesLocationBias;
};

export async function getTopActivities(
  destination: string,
  category: string,
  options: GetTopActivitiesOptions = {},
): Promise<TopActivity[]> {
  const apiKey = resolvePlacesApiKey(options.env ?? process.env);
  if (!apiKey) {
    return [];
  }

  const dest = destination.trim();
  const cat = category.trim();
  if (!dest || !cat) {
    return [];
  }

  const kind = placeKindForCategory(cat);
  const maxResults = options.maxResults ?? defaultMaxResultsForKind(kind);
  const fetchImpl = options.fetchImpl ?? fetch;
  const query = `${cat} in ${dest}`;

  const body: Record<string, unknown> = { textQuery: query };
  if (
    options.location &&
    Number.isFinite(options.location.lat) &&
    Number.isFinite(options.location.lng)
  ) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.location.lat,
          longitude: options.location.lng,
        },
        radius: options.location.radiusMeters ?? DEFAULT_PLACES_RADIUS_METERS,
      },
    };
  }

  const response = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.formattedAddress",
        "places.location",
        "places.photos",
        "places.types",
        "places.primaryType",
        "places.websiteUri",
        // Same SKU band as rating/websiteUri — avoids per-POI Details fan-out (FAM-66).
        "places.regularOpeningHours",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new PlacesApiError(response.status, errBody);
  }

  const data = (await response.json()) as { places?: PlacesSearchTextPlace[] };
  return rankTopActivitiesFromPlaces(data.places ?? [], {
    maxResults,
    kind,
    category: cat,
  });
}
