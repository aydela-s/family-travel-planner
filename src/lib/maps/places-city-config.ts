/**
 * Build a temporary CityConfig from Places Text Search results (FAM-59).
 * Curated CITY_CONFIGS stay the gold standard — only used for non-curated destinations.
 */

import {
  CITY_CONFIGS,
  CityConfig,
  DEFAULT_CITY,
  Landmark,
  LandmarkAgeTag,
  LandmarkIntensity,
  LandmarkInterestTag,
  LandmarkOpeningHours,
} from "@/config/city-pricing";
import { detectCity } from "@/lib/city-detect";
import {
  getOrFetchTopActivities,
  type GetOrFetchOptions,
} from "@/lib/maps/top-activities-cache";
import type { TopActivity } from "@/lib/maps/get-top-activities";
import { INTEREST_LABEL_TO_TAGS } from "@/lib/schedule/interest-map";
import { TripPlan } from "@/types/trip-plan";

/** Soft floor — below this we keep DEFAULT_CITY fakes. */
export const MIN_PLACES_LANDMARKS = 4;
const MAX_CATEGORIES = 8;

const INDOOR_TAGS = new Set<LandmarkInterestTag>([
  "museums",
  "interactive",
  "indoor-play",
  "shopping",
  "spas",
  "entertainment",
]);

const HIGH_INTENSITY_TAGS = new Set<LandmarkInterestTag>([
  "theme-parks",
  "playgrounds",
  "indoor-play",
  "sports",
]);

const LOW_INTENSITY_TAGS = new Set<LandmarkInterestTag>(["museums", "spas", "history"]);

export function isCuratedCity(city: CityConfig): boolean {
  return CITY_CONFIGS.some((c) => c.id === city.id);
}

/** Wizard labels (or free text) used as Places text-search categories. */
export function placesSearchCategoriesFromInterests(interests: string[]): string[] {
  const labels = interests.map((i) => i.trim()).filter(Boolean);
  if (labels.length === 0) {
    return ["family attractions", "parks", "museums"];
  }
  return [...new Set(labels)].slice(0, MAX_CATEGORIES);
}

export function interestTagsForSearchCategory(category: string): LandmarkInterestTag[] {
  const trimmed = category.trim();
  if (INTEREST_LABEL_TO_TAGS[trimmed]) {
    return INTEREST_LABEL_TO_TAGS[trimmed];
  }
  // Free-text fallbacks (e.g. "zoos", "family attractions")
  const lower = trimmed.toLowerCase();
  for (const [label, tags] of Object.entries(INTEREST_LABEL_TO_TAGS)) {
    if (lower.includes(label.toLowerCase()) || label.toLowerCase().includes(lower)) {
      return tags;
    }
  }
  if (/zoo|aquarium/.test(lower)) return ["zoos"];
  if (/museum|gallery/.test(lower)) return ["museums"];
  if (/playground|soft play|bounce/.test(lower)) return ["playgrounds", "indoor-play"];
  if (/beach|waterfront|harbor/.test(lower)) return ["beaches"];
  if (/park|garden/.test(lower)) return ["parks"];
  if (/theme|amusement|roller/.test(lower)) return ["theme-parks"];
  return ["parks"];
}

export function adultPriceFromPriceLevel(priceLevel: string | null): number {
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 15;
    case "PRICE_LEVEL_MODERATE":
      return 25;
    case "PRICE_LEVEL_EXPENSIVE":
      return 40;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 60;
    default:
      return 20;
  }
}

function intensityForTags(tags: LandmarkInterestTag[]): LandmarkIntensity {
  if (tags.some((t) => HIGH_INTENSITY_TAGS.has(t))) return "high";
  if (tags.every((t) => LOW_INTENSITY_TAGS.has(t))) return "low";
  return "medium";
}

function indoorForTags(tags: LandmarkInterestTag[]): boolean {
  return tags.some((t) => INDOOR_TAGS.has(t));
}

function openingHoursForTags(tags: LandmarkInterestTag[]): LandmarkOpeningHours {
  if (tags.includes("beaches") || tags.includes("parks") || tags.includes("nature")) {
    return { open: "08:00", close: "20:00" };
  }
  if (tags.includes("theme-parks")) {
    return { open: "10:00", close: "20:00" };
  }
  return { open: "09:00", close: "18:00" };
}

const DEFAULT_AGE_TAGS: LandmarkAgeTag[] = ["toddler", "child", "tween", "teen"];

export function landmarkFromTopActivity(
  place: TopActivity,
  interestTags: LandmarkInterestTag[],
): Landmark | null {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    return null;
  }
  const tags = interestTags.length > 0 ? interestTags : (["parks"] as LandmarkInterestTag[]);
  return {
    name: place.name,
    lat: place.latitude,
    lng: place.longitude,
    adultPrice: adultPriceFromPriceLevel(place.priceLevel),
    openingHours: openingHoursForTags(tags),
    intensity: intensityForTags(tags),
    ageTags: DEFAULT_AGE_TAGS,
    interestTags: tags,
    indoor: indoorForTags(tags),
    placeId: place.id,
    rating: place.rating,
    reviewCount: place.reviewCount,
  };
}

export function landmarksFromPlacesResults(
  results: Array<{ category: string; places: TopActivity[] }>,
): Landmark[] {
  const byName = new Map<string, Landmark>();
  for (const { category, places } of results) {
    const tags = interestTagsForSearchCategory(category);
    for (const place of places) {
      const landmark = landmarkFromTopActivity(place, tags);
      if (!landmark) continue;
      const key = landmark.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, landmark);
        continue;
      }
      // Merge interest tags when the same place appears under multiple categories.
      const merged = new Set([...existing.interestTags, ...landmark.interestTags]);
      byName.set(key, { ...existing, interestTags: [...merged] });
    }
  }
  return [...byName.values()];
}

export type BuildPlacesCityOptions = GetOrFetchOptions & {
  minLandmarks?: number;
};

/**
 * Fetch ranked Places POIs per interest and build a CityConfig.
 * Returns null when Places is unavailable or the pool is too small (caller keeps DEFAULT).
 */
export async function buildCityConfigFromPlaces(
  destination: string,
  interests: string[],
  options: BuildPlacesCityOptions = {},
): Promise<CityConfig | null> {
  const categories = placesSearchCategoriesFromInterests(interests);
  const settled = await Promise.all(
    categories.map(async (category) => {
      try {
        const result = await getOrFetchTopActivities(destination, category, options);
        return { category, places: result.places };
      } catch {
        return { category, places: [] as TopActivity[] };
      }
    }),
  );

  const landmarks = landmarksFromPlacesResults(settled);
  const minLandmarks = options.minLandmarks ?? MIN_PLACES_LANDMARKS;
  if (landmarks.length < minLandmarks) {
    return null;
  }

  const center = landmarks[0]!;
  const shortName = destination.split(",")[0]?.trim() || destination.trim() || DEFAULT_CITY.name;

  return {
    ...DEFAULT_CITY,
    id: `places:${shortName.toLowerCase().replace(/\s+/g, "-")}`,
    name: shortName,
    lat: center.lat,
    lng: center.lng,
    landmarks,
  };
}

/**
 * Curated cities unchanged; non-curated try Places, else DEFAULT_CITY clone.
 */
export async function resolvePlanningCity(
  plan: Pick<TripPlan, "destination" | "interests">,
  options: BuildPlacesCityOptions = {},
): Promise<CityConfig> {
  const detected = detectCity(plan.destination);
  if (isCuratedCity(detected)) {
    return detected;
  }
  const fromPlaces = await buildCityConfigFromPlaces(
    plan.destination,
    plan.interests,
    options,
  );
  return fromPlaces ?? detected;
}
