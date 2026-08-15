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
import { detectCity, detectCityFromPlan } from "@/lib/city-detect";
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
  // Map wizard labels to Places queries that match the category intent.
  const queries = labels.map((label) => {
    if (label === "Interactive Museums") {
      return "science museum children's museum interactive exhibits";
    }
    if (label === "Theme Parks") {
      return "theme park amusement park water park";
    }
    if (label === "Playgrounds & Indoor Play" || label === "Playgrounds") {
      return "indoor playground soft play kids play cafe";
    }
    return label;
  });
  return [...new Set(queries)].slice(0, MAX_CATEGORIES);
}

export function interestTagsForSearchCategory(category: string): LandmarkInterestTag[] {
  const trimmed = category.trim();
  if (INTEREST_LABEL_TO_TAGS[trimmed]) {
    return INTEREST_LABEL_TO_TAGS[trimmed];
  }
  // Free-text fallbacks (e.g. "zoos", "family attractions")
  const lower = trimmed.toLowerCase();
  // Places query remaps from placesSearchCategoriesFromInterests
  if (/science museum|children'?s museum|interactive exhibit/.test(lower)) {
    return ["interactive"];
  }
  if (/theme park|amusement park|water park/.test(lower)) {
    return ["theme-parks"];
  }
  if (/indoor playground|soft play|play cafe/.test(lower)) {
    return ["playgrounds", "indoor-play"];
  }
  for (const [label, tags] of Object.entries(INTEREST_LABEL_TO_TAGS)) {
    if (lower.includes(label.toLowerCase()) || label.toLowerCase().includes(lower)) {
      return tags;
    }
  }
  if (/zoo|aquarium/.test(lower)) return ["zoos"];
  if (/museum|gallery/.test(lower)) return ["museums"];
  if (/playground|soft play|bounce/.test(lower)) return ["playgrounds", "indoor-play"];
  if (/beach|waterfront|harbor/.test(lower)) return ["beaches"];
  // Theme / amusement before generic "park" so "theme park" isn't tagged as parks.
  if (/theme\s*park|amusement|water\s*park|waterpark|roller\s*coaster/.test(lower)) {
    return ["theme-parks"];
  }
  if (/park|garden/.test(lower)) return ["parks"];
  return ["parks"];
}

/**
 * Theme Parks = amusement / water parks / major ticketed parks — not city parks or soft play.
 * Places text search for "Theme Parks" often returns green spaces; demote those.
 */
const REAL_THEME_PARK_NAME =
  /\b(theme\s*park|amusement|water\s*park|waterpark|six\s*flags|disney|universal|legoland|seaworld|cedar\s*point|busch\s*gardens|roller\s*coaster|ferris\s*wheel)\b/i;

const CITY_OR_GARDEN_PARK_NAME =
  /\b(park|garden|arboretum|greenbelt|plaza|commons)\b/i;

const INDOOR_PLAY_NAME =
  /\b(kids\s*empire|soft\s*play|bounce\s*house|trampolin|indoor\s*play|play\s*cafe|urban\s*air|sky\s*zone|peekn?\s*play|dino\s*kidz|fritz'?s?\s*adventure|adventure\s*park|kids?\s*gym)\b/i;

const LOOK_DONT_TOUCH_MUSEUM_NAME =
  /\b(sculpture|art\s+museum|gallery|samurai|history\s+museum|nasher|barbier|mueller)\b/i;

const HANDS_ON_INTERACTIVE_NAME =
  /\b(perot|meow\s*wolf|children'?s\s+museum|science\s+(center|museum)|discovery\s+center|bubble\s+planet|hands[-\s]?on|planetarium)\b/i;

export function refineInterestTagsForPlaceName(
  name: string,
  tags: LandmarkInterestTag[],
): LandmarkInterestTag[] {
  let next = [...tags];

  if (next.includes("theme-parks") && !REAL_THEME_PARK_NAME.test(name)) {
    if (INDOOR_PLAY_NAME.test(name)) {
      next = next.filter((t) => t !== "theme-parks" && t !== "playgrounds");
      if (!next.includes("indoor-play")) next.push("indoor-play");
    } else if (CITY_OR_GARDEN_PARK_NAME.test(name)) {
      next = next.filter((t) => t !== "theme-parks");
      if (!next.includes("parks")) next.push("parks");
    } else {
      // Unknown venue returned under Theme Parks search — drop the ticketed tag.
      next = next.filter((t) => t !== "theme-parks");
      if (next.length === 0) next.push("parks");
    }
  }

  // Soft-play / indoor adventure centers are indoor-play only — never outdoor playground days.
  if (INDOOR_PLAY_NAME.test(name)) {
    if (!next.includes("indoor-play")) next.push("indoor-play");
    next = next.filter((t) => t !== "theme-parks" && t !== "playgrounds");
  }

  // Art / history museums must not satisfy "Interactive Museums".
  if (LOOK_DONT_TOUCH_MUSEUM_NAME.test(name)) {
    next = next.filter((t) => t !== "interactive");
    if (!next.includes("museums")) next.push("museums");
  } else if (HANDS_ON_INTERACTIVE_NAME.test(name)) {
    if (!next.includes("interactive")) next.push("interactive");
  }

  return next;
}

/** Public beaches/parks are free; theme/amusement parks stay ticketed. */
export function adultPriceForPlace(
  name: string,
  tags: LandmarkInterestTag[],
  priceLevel: string | null,
): number {
  const mapped = adultPriceFromPriceLevel(priceLevel);
  if (tags.includes("theme-parks") || REAL_THEME_PARK_NAME.test(name)) {
    return mapped > 0 ? mapped : 40;
  }
  if (
    tags.includes("beaches") ||
    tags.includes("parks") ||
    tags.includes("nature") ||
    tags.includes("playgrounds")
  ) {
    // Soft play / indoor play centers are usually ticketed.
    if (tags.includes("indoor-play") || INDOOR_PLAY_NAME.test(name)) {
      return mapped > 0 ? mapped : 20;
    }
    return 0;
  }
  return mapped;
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

const ARCADE_OR_TEEN_VENUE =
  /\b(arcade|bowling|laser\s*tag|escape\s*room|vr\s*experience|go[\s-]?kart|axe\s*throw)\b/i;

/** Age bands implied by the venue name when Places doesn't provide them. */
export function ageTagsForPlaceName(
  name: string,
  tags: LandmarkInterestTag[],
): LandmarkAgeTag[] {
  // Arcades / bowling / laser tag are a poor fit for toddlers and young preschoolers.
  if (ARCADE_OR_TEEN_VENUE.test(name)) return ["tween", "teen"];
  if (tags.includes("indoor-play") || INDOOR_PLAY_NAME.test(name)) {
    return ["toddler", "child"];
  }
  if (tags.includes("theme-parks") || REAL_THEME_PARK_NAME.test(name)) {
    return ["toddler", "child", "tween", "teen"];
  }
  return DEFAULT_AGE_TAGS;
}

export function landmarkFromTopActivity(
  place: TopActivity,
  interestTags: LandmarkInterestTag[],
): Landmark | null {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    return null;
  }
  const raw = interestTags.length > 0 ? interestTags : (["parks"] as LandmarkInterestTag[]);
  const tags = refineInterestTagsForPlaceName(place.name, raw);
  return {
    name: place.name,
    lat: place.latitude,
    lng: place.longitude,
    adultPrice: adultPriceForPlace(place.name, tags, place.priceLevel),
    openingHours: openingHoursForTags(tags),
    intensity: intensityForTags(tags),
    ageTags: ageTagsForPlaceName(place.name, tags),
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
      const merged = refineInterestTagsForPlaceName(existing.name, [
        ...new Set([...existing.interestTags, ...landmark.interestTags]),
      ]);
      byName.set(key, {
        ...existing,
        interestTags: merged,
        intensity: intensityForTags(merged),
        indoor: indoorForTags(merged),
        openingHours: openingHoursForTags(merged),
      });
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

  const detected = detectCity(destination);
  const shortName = destination.split(",")[0]?.trim() || destination.trim() || DEFAULT_CITY.name;

  return {
    ...DEFAULT_CITY,
    id: `places:${shortName.toLowerCase().replace(/\s+/g, "-")}`,
    name: shortName,
    // Prefer known destination center (Places pick / popular); not first zoo pin.
    lat: detected.lat,
    lng: detected.lng,
    landmarks,
  };
}

/**
 * Curated cities unchanged; non-curated try Places, else DEFAULT_CITY clone.
 */
export async function resolvePlanningCity(
  plan: Pick<TripPlan, "destination" | "interests" | "destinationLat" | "destinationLng">,
  options: BuildPlacesCityOptions = {},
): Promise<CityConfig> {
  const detected = detectCityFromPlan(plan);
  if (isCuratedCity(detected)) {
    return detected;
  }
  const fromPlaces = await buildCityConfigFromPlaces(
    plan.destination,
    plan.interests,
    options,
  );
  if (fromPlaces) {
    // Keep Places-resolved destination center when the wizard already pinned one.
    if (
      typeof plan.destinationLat === "number" &&
      typeof plan.destinationLng === "number" &&
      Number.isFinite(plan.destinationLat) &&
      Number.isFinite(plan.destinationLng)
    ) {
      return {
        ...fromPlaces,
        lat: plan.destinationLat,
        lng: plan.destinationLng,
      };
    }
    return fromPlaces;
  }
  return detected;
}
