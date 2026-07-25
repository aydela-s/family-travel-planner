/**
 * Server-side only — never import into a client component.
 *
 * Places API (New) Text Search → filter low-rated/low-review results →
 * ranked list for itinerary / AI "pick from this list" context (FAM-58).
 */

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
};

export const MIN_RATING = 4.3;
export const MIN_REVIEWS = 150;
export const MAX_RESULTS = 15;

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
  env: NodeJS.ProcessEnv = process.env,
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

/** Pure filter + rank — unit-tested without network. */
export function rankTopActivitiesFromPlaces(
  places: PlacesSearchTextPlace[],
  maxResults: number = MAX_RESULTS,
): TopActivity[] {
  return places
    .filter(
      (p): p is PlacesSearchTextPlace & { id: string; rating: number; userRatingCount: number } =>
        typeof p.id === "string" &&
        typeof p.rating === "number" &&
        p.rating >= MIN_RATING &&
        typeof p.userRatingCount === "number" &&
        p.userRatingCount >= MIN_REVIEWS,
    )
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "Unknown",
      rating: p.rating,
      reviewCount: p.userRatingCount,
      priceLevel: p.priceLevel ?? null,
      address: p.formattedAddress ?? null,
      latitude: p.location?.latitude ?? null,
      longitude: p.location?.longitude ?? null,
      photoRef: p.photos?.[0]?.name ?? null,
      score: activityScore(p.rating, p.userRatingCount),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

export type GetTopActivitiesOptions = {
  maxResults?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

export async function getTopActivities(
  destination: string,
  category: string,
  options: GetTopActivitiesOptions = {},
): Promise<TopActivity[]> {
  const apiKey = resolvePlacesApiKey(options.env ?? process.env);
  if (!apiKey) {
    throw new PlacesApiKeyMissingError();
  }

  const dest = destination.trim();
  const cat = category.trim();
  if (!dest || !cat) {
    return [];
  }

  const maxResults = options.maxResults ?? MAX_RESULTS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const query = `${cat} in ${dest}`;

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
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: query,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new PlacesApiError(response.status, errBody);
  }

  const data = (await response.json()) as { places?: PlacesSearchTextPlace[] };
  return rankTopActivitiesFromPlaces(data.places ?? [], maxResults);
}
