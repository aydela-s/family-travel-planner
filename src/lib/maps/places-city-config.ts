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
import type { CityRestaurant, RestaurantDietary } from "@/config/city-restaurants";
import { detectCity, detectCityFromPlan } from "@/lib/city-detect";
import {
  DEFAULT_PLACES_RADIUS_METERS,
  MAX_RESTAURANT_RESULTS,
  type PlacesLocationBias,
  type TopActivity,
} from "@/lib/maps/get-top-activities";
import { mealsServedByPlace } from "@/lib/maps/family-friendly-places";
import {
  coordsMatchDefaultCity,
  resolveDestinationCenter,
} from "@/lib/maps/resolve-destination-center";
import {
  getOrFetchTopActivities,
  type GetOrFetchOptions,
} from "@/lib/maps/top-activities-cache";
import {
  mergeHoursByWeekdayPreferExisting,
  typicalOpeningHoursFromWeekday,
} from "@/lib/maps/places-hours";
import { dietaryEvidenceFromText, parseDietaryTags } from "@/lib/planning-engine/dietary";
import { INTEREST_LABEL_TO_TAGS } from "@/lib/schedule/interest-map";
import type { BudgetStyle, TripPlan } from "@/types/trip-plan";

/** Soft floor — below this we keep DEFAULT_CITY fakes. */
export const MIN_PLACES_LANDMARKS = 4;
const MAX_CATEGORIES = 8;
export const PLACES_RESTAURANT_CATEGORY = "family restaurants";

/** Places Text Search categories for restaurants, tagged by dietary need. */
export function placesRestaurantSearchPlans(
  dietaryRestrictions: string,
): Array<{ category: string; dietary: RestaurantDietary[] }> {
  const tags = parseDietaryTags(dietaryRestrictions);
  if (tags.includes("vegan")) {
    return [
      { category: "vegan restaurants", dietary: ["vegan"] },
      { category: "vegan cafes", dietary: ["vegan"] },
    ];
  }
  if (tags.includes("vegetarian")) {
    return [{ category: "vegetarian restaurants", dietary: ["vegetarian"] }];
  }
  if (tags.includes("gluten-free")) {
    return [{ category: "gluten free restaurants", dietary: ["gluten-free"] }];
  }
  if (tags.includes("dairy-free")) {
    return [{ category: "dairy free restaurants", dietary: ["dairy-free"] }];
  }
  return [{ category: PLACES_RESTAURANT_CATEGORY, dietary: [] }];
}

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
export type PlacesSearchCategoryOptions = {
  /** Youngest child age — drives kid-oriented remaps for Shows / Sports / Museums. */
  youngestChildAge?: number | null;
};

/** Prefer kid-oriented Places queries when the trip includes young children. */
export function prefersKidOrientedPlacesQueries(youngestChildAge?: number | null): boolean {
  return typeof youngestChildAge === "number" && Number.isFinite(youngestChildAge) && youngestChildAge <= 10;
}

export function placesSearchCategoriesFromInterests(
  interests: string[],
  options: PlacesSearchCategoryOptions = {},
): string[] {
  const labels = interests.map((i) => i.trim()).filter(Boolean);
  if (labels.length === 0) {
    return ["family attractions", "parks", "museums"];
  }
  const kidQueries = prefersKidOrientedPlacesQueries(options.youngestChildAge);
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
    if (label === "Shows & Entertainment" || label === "Shows") {
      return kidQueries
        ? "children's theater family show puppet show kids entertainment magic show"
        : "family musical theater live show";
    }
    if (label === "Sports & Recreation") {
      return kidQueries
        ? "family recreation center kids sports ice skating bowling community center"
        : "family recreation bike rental ice skating bowling";
    }
    if (label === "Museums & Art") {
      return kidQueries
        ? "children's museum family art activity pottery painting kids museum"
        : "art museum family gallery";
    }
    if (label === "Shopping") {
      return "shopping mall outlet center premium outlets galleria";
    }
    if (label === "Swimming & Water Play") {
      return "family aquatic center indoor water park swimming pool splash pad";
    }
    if (label === "Beaches & Waterfronts") {
      return "beach waterfront boardwalk swimming";
    }
    if (label === "Nature & Scenic Views") {
      return "scenic overlook nature trail botanical garden viewpoint";
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
  if (/children'?s?\s+theater|family\s+show|puppet\s+show|kids?\s+entertainment|magic\s+show/.test(lower)) {
    return ["entertainment"];
  }
  if (/family\s+recreation|kids?\s+sports|community\s+center|ice\s+skating/.test(lower)) {
    return ["sports"];
  }
  if (/family\s+art|pottery|painting|kids?\s+museum|children'?s?\s+museum/.test(lower)) {
    return ["museums"];
  }
  if (/shopping\s+mall|outlet\s+center|premium\s+outlets|galleria/.test(lower)) {
    return ["shopping"];
  }
  if (/aquatic\s+center|indoor\s+water\s+park|splash\s+pad|swimming\s+pool/.test(lower)) {
    return ["beaches"];
  }
  if (/beach\s+waterfront|boardwalk\s+swimming/.test(lower)) {
    return ["beaches"];
  }
  if (/scenic\s+overlook|nature\s+trail|botanical\s+garden|viewpoint/.test(lower)) {
    return ["nature"];
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
  /\b(theme\s*park|amusement|water\s*park|waterpark|hawaiian\s+waters|hawaiian\s+falls|six\s*flags|disney|universal|legoland|seaworld|cedar\s*point|busch\s*gardens|roller\s*coaster|ferris\s*wheel)\b/i;

const CITY_OR_GARDEN_PARK_NAME =
  /\b(park|garden|arboretum|greenbelt|plaza|commons)\b/i;

const INDOOR_PLAY_NAME =
  /\b(kids\s*empire|soft\s*play|bounce\s*house|trampolin|indoor\s*play|play\s*cafe|urban\s*air|sky\s*zone|peekn?\s*play|dino\s*kidz|fritz'?s?\s*adventure|adventure\s*park|kids?\s*gym)\b/i;

const LOOK_DONT_TOUCH_MUSEUM_NAME =
  /\b(sculpture|art\s+museum|gallery|samurai|history\s+museum|nasher|barbier|mueller)\b/i;

const HANDS_ON_INTERACTIVE_NAME =
  /\b(perot|meow\s*wolf|children'?s\s+museum|science\s+(center|museum)|discovery\s+center|bubble\s+planet|hands[-\s]?on|planetarium)\b/i;

const DESTINATION_SHOPPING_LANDMARK_NAME =
  /\b(mall|outlet|outlets|galleria|premium\s+outlets|northpark|westfield|shopping\s+district|grapevine\s+mills|mills)\b/i;

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

  // Only destination malls/outlets keep the shopping tag — strip centers and
  // random plazas ("The Hill", "Lincoln Park") must not schedule as shopping.
  if (next.includes("shopping") && !DESTINATION_SHOPPING_LANDMARK_NAME.test(name)) {
    next = next.filter((t) => t !== "shopping");
    if (next.length === 0) next.push("parks");
  }

  // Aquatic centers / water parks count as water-play (beaches coverage).
  // Match brand names like "Hawaiian Waters" that omit the words "water park".
  if (
    /\b(aquatic|indoor\s+water\s*park|water\s*park|waterpark|splash\s*pad|hawaiian\s+waters|hawaiian\s+falls)\b/i.test(
      name,
    )
  ) {
    if (!next.includes("beaches")) next.push("beaches");
    next = next.filter((t) => t !== "theme-parks" && t !== "parks");
  }

  return next;
}

/** Public beaches/parks are free; theme/amusement parks and aquatic centers stay ticketed. */
export function adultPriceForPlace(
  name: string,
  tags: LandmarkInterestTag[],
  priceLevel: string | null,
): number {
  const mapped = adultPriceFromPriceLevel(priceLevel);
  const paidWaterPlay =
    /\b(aquatic|water\s*park|waterpark|splash\s*pad|hawaiian\s+waters|hawaiian\s+falls)\b/i.test(
      name,
    );
  if (tags.includes("theme-parks") || REAL_THEME_PARK_NAME.test(name) || paidWaterPlay) {
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
  // Malls / outlets aren't ticketed attractions — Google priceLevel is for shops, not entry.
  if (tags.includes("shopping")) {
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

export function budgetStylesFromPriceLevel(priceLevel: string | null): BudgetStyle[] {
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return ["save", "balanced"];
    case "PRICE_LEVEL_EXPENSIVE":
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return ["balanced", "splurge"];
    default:
      return ["save", "balanced", "splurge"];
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
  /\b(arcade|laser\s*tag|escape\s*room|vr\s*experience|go[\s-]?kart|axe\s*throw)\b/i;

const FAMILY_BOWLING_OR_SKATING =
  /\b(bowling|ice\s*rink|ice\s*skating|roller\s*skating|mini\s*golf)\b/i;

const KID_SHOW_NAME =
  /\b(children'?s?\s+(theatre|theater|show)|puppet|magic\s*show|circus|disney\s*on\s*ice|family\s*(show|musical|theatre|theater)|kids?\s*(show|theatre|theater))\b/i;

const ADULT_SHOW_VENUE =
  /\b(opera|symphony|philharmonic|ballet|comedy\s*club|improv|concert\s*hall|music\s*hall|amphitheatre|amphitheater|bomb\s*factory|performing\s*arts|majestic\s+(theatre|theater)|dinner\s*(&|and)\s*tournament|medieval\s*times)\b/i;

const ADULT_SPORTS_VENUE =
  /\b(stadium|arena|nfl|nba|mlb|nhl|crossfit|boxing\s*gym|fitness\s*center)\b/i;

const KID_REC_VENUE =
  /\b(recreation\s*center|rec\s*center|ymca|ywca|community\s*center|family\s*fun)\b/i;

const ADULT_ART_VENUE =
  /\b(sculpture|art\s+museum|gallery|opera\s+house|symphony)\b/i;

const KID_MUSEUM_OR_ART_ACTIVITY =
  /\b(children'?s\s+museum|kids?\s+museum|pottery|paint[\s-]?your[\s-]?own|paint\s+pottery|porcelain|family\s+art|craft\s+workshop)\b/i;

/** Age bands implied by the venue name / Places types when Places doesn't provide them. */
export function ageTagsForPlaceName(
  name: string,
  tags: LandmarkInterestTag[],
  placeTypes: string[] = [],
): LandmarkAgeTag[] {
  const types = placeTypes.map((t) => t.toLowerCase());

  if (KID_SHOW_NAME.test(name) || KID_MUSEUM_OR_ART_ACTIVITY.test(name) || KID_REC_VENUE.test(name)) {
    return ["toddler", "child", "tween"];
  }
  if (tags.includes("indoor-play") || INDOOR_PLAY_NAME.test(name)) {
    return ["toddler", "child"];
  }
  if (FAMILY_BOWLING_OR_SKATING.test(name)) {
    return ["child", "tween", "teen"];
  }
  if (ARCADE_OR_TEEN_VENUE.test(name)) return ["tween", "teen"];

  if (
    ADULT_SHOW_VENUE.test(name) ||
    types.includes("performing_arts_theater") ||
    types.includes("concert_hall") ||
    types.includes("opera_house")
  ) {
    return ["tween", "teen"];
  }
  if (ADULT_SPORTS_VENUE.test(name) || types.includes("stadium") || types.includes("arena")) {
    return ["tween", "teen"];
  }
  if (
    ADULT_ART_VENUE.test(name) ||
    LOOK_DONT_TOUCH_MUSEUM_NAME.test(name) ||
    types.includes("art_gallery")
  ) {
    return ["child", "tween", "teen"];
  }
  if (tags.includes("theme-parks") || REAL_THEME_PARK_NAME.test(name)) {
    return ["toddler", "child", "tween", "teen"];
  }
  if (tags.includes("entertainment") && !KID_SHOW_NAME.test(name)) {
    // Generic entertainment from Places without a kid-show signal — older kids only.
    return ["tween", "teen"];
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
  const hoursByWeekday = place.hoursByWeekday ?? undefined;
  const placesTypical = typicalOpeningHoursFromWeekday(hoursByWeekday);
  return {
    name: place.name,
    lat: place.latitude,
    lng: place.longitude,
    adultPrice: adultPriceForPlace(place.name, tags, place.priceLevel),
    // Prefer Places weekday-derived typical hours when Text Search returned a schedule.
    openingHours: placesTypical ?? openingHoursForTags(tags),
    ...(hoursByWeekday
      ? { hoursByWeekday }
      : // Category guess, not venue data — must never exclude the place.
        { hoursConfidence: "assumed" as const }),
    intensity: intensityForTags(tags),
    ageTags: ageTagsForPlaceName(place.name, tags, place.types ?? []),
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
      const hoursByWeekday = mergeHoursByWeekdayPreferExisting(
        existing.hoursByWeekday,
        landmark.hoursByWeekday,
      );
      const placesTypical = typicalOpeningHoursFromWeekday(hoursByWeekday);
      byName.set(key, {
        ...existing,
        interestTags: merged,
        intensity: intensityForTags(merged),
        indoor: indoorForTags(merged),
        openingHours: placesTypical ?? openingHoursForTags(merged),
        ...(hoursByWeekday
          ? { hoursByWeekday, hoursConfidence: undefined }
          : { hoursConfidence: "assumed" as const }),
      });
    }
  }
  return [...byName.values()];
}

export function restaurantFromTopActivity(
  place: TopActivity,
  dietary: RestaurantDietary[] = [],
): CityRestaurant | null {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    return null;
  }
  const hoursByWeekday = place.hoursByWeekday ?? undefined;
  const placesTypical = typicalOpeningHoursFromWeekday(hoursByWeekday);
  // Only what the place itself states counts as dietary evidence; no hours are
  // invented, and no ages are inferred (both stay curated-only fields).
  const evidence = dietaryEvidenceFromText([
    place.name,
    place.editorialSummary,
    ...(place.reviewSnippets ?? []),
  ]).filter((tag) => !dietary.includes(tag));
  return {
    name: place.name,
    lat: place.latitude,
    lng: place.longitude,
    meals: mealsServedByPlace({
      name: place.name,
      types: place.types,
      primaryType: place.primaryType,
    }),
    ageTags: ["toddler", "child", "tween", "teen"],
    dietary: [...dietary],
    ...(evidence.length > 0 ? { dietaryOptions: evidence } : {}),
    budgetStyles: budgetStylesFromPriceLevel(place.priceLevel),
    familyNote:
      dietary.length > 0
        ? `Family-friendly spot from Google Places (${dietary.join(", ")} search).`
        : "Nearby restaurant from Google Places.",
    ...(placesTypical ? { openingHours: placesTypical } : {}),
    ...(hoursByWeekday ? { hoursByWeekday } : {}),
    rating: place.rating,
    reviewCount: place.reviewCount,
    placeId: place.id,
  };
}

export function restaurantsFromPlacesResults(
  places: TopActivity[],
  dietary: RestaurantDietary[] = [],
): CityRestaurant[] {
  const byName = new Map<string, CityRestaurant>();
  for (const place of places) {
    const restaurant = restaurantFromTopActivity(place, dietary);
    if (!restaurant) continue;
    const key = restaurant.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, restaurant);
      continue;
    }
    // Merge dietary tags when the same place appears in multiple diet searches.
    const merged = new Set([...existing.dietary, ...restaurant.dietary]);
    const mergedOptions = new Set([
      ...(existing.dietaryOptions ?? []),
      ...(restaurant.dietaryOptions ?? []),
    ]);
    byName.set(key, {
      ...existing,
      dietary: [...merged],
      ...(mergedOptions.size > 0
        ? { dietaryOptions: [...mergedOptions].filter((tag) => !merged.has(tag)) }
        : {}),
      openingHours: existing.openingHours ?? restaurant.openingHours,
      hoursByWeekday: existing.hoursByWeekday ?? restaurant.hoursByWeekday,
      reviewCount: existing.reviewCount ?? restaurant.reviewCount,
      rating: existing.rating ?? restaurant.rating,
    });
  }
  return [...byName.values()].slice(0, MAX_RESTAURANT_RESULTS);
}

function locationBiasFromCity(lat: number, lng: number): PlacesLocationBias | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || coordsMatchDefaultCity(lat, lng)) {
    return undefined;
  }
  return { lat, lng, radiusMeters: DEFAULT_PLACES_RADIUS_METERS };
}

export type BuildPlacesCityOptions = GetOrFetchOptions & {
  minLandmarks?: number;
  youngestChildAge?: number | null;
  dietaryRestrictions?: string;
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
  const categories = placesSearchCategoriesFromInterests(interests, {
    youngestChildAge: options.youngestChildAge,
  });
  const restaurantPlans = placesRestaurantSearchPlans(options.dietaryRestrictions ?? "");
  const detected = detectCity(destination);
  const location =
    options.location ?? locationBiasFromCity(detected.lat, detected.lng);
  const searchOptions = { ...options, location };

  const restaurantCategories = new Set(restaurantPlans.map((p) => p.category));
  const settled = await Promise.all(
    [...categories, ...restaurantPlans.map((p) => p.category)].map(async (category) => {
      try {
        const result = await getOrFetchTopActivities(destination, category, searchOptions);
        return { category, places: result.places };
      } catch {
        return { category, places: [] as TopActivity[] };
      }
    }),
  );

  const landmarkRows = settled.filter((row) => !restaurantCategories.has(row.category));
  // Hours come from Text Search `regularOpeningHours` on each TopActivity — no Details fan-out.
  const landmarks = landmarksFromPlacesResults(landmarkRows);
  const restaurantsByName = new Map<string, CityRestaurant>();
  for (const plan of restaurantPlans) {
    const row = settled.find((r) => r.category === plan.category);
    for (const restaurant of restaurantsFromPlacesResults(row?.places ?? [], plan.dietary)) {
      const key = restaurant.name.toLowerCase();
      const existing = restaurantsByName.get(key);
      if (!existing) {
        restaurantsByName.set(key, restaurant);
        continue;
      }
      restaurantsByName.set(key, {
        ...existing,
        dietary: [...new Set([...existing.dietary, ...restaurant.dietary])],
        reviewCount: existing.reviewCount ?? restaurant.reviewCount,
        rating: existing.rating ?? restaurant.rating,
      });
    }
  }
  const restaurants = [...restaurantsByName.values()].slice(0, MAX_RESTAURANT_RESULTS);
  const minLandmarks = options.minLandmarks ?? MIN_PLACES_LANDMARKS;
  if (landmarks.length < minLandmarks) {
    return null;
  }

  const shortName = destination.split(",")[0]?.trim() || destination.trim() || DEFAULT_CITY.name;

  return {
    ...DEFAULT_CITY,
    id: `places:${shortName.toLowerCase().replace(/\s+/g, "-")}`,
    name: shortName,
    // Prefer known destination center (Places pick / popular); not first zoo pin.
    lat: location?.lat ?? detected.lat,
    lng: location?.lng ?? detected.lng,
    landmarks,
    restaurants,
  };
}

/**
 * Curated cities unchanged; non-curated try Places, else DEFAULT_CITY clone.
 */
export async function resolvePlanningCity(
  plan: Pick<
    TripPlan,
    | "destination"
    | "interests"
    | "destinationLat"
    | "destinationLng"
    | "destinationPlaceId"
    | "children"
    | "dietaryRestrictions"
  >,
  options: BuildPlacesCityOptions = {},
): Promise<CityConfig> {
  const detected = detectCityFromPlan(plan);
  if (isCuratedCity(detected)) {
    return detected;
  }

  const youngestChildAge =
    options.youngestChildAge ??
    (plan.children.length > 0 ? Math.min(...plan.children) : null);
  const center = await resolveDestinationCenter(plan, options);
  const location = locationBiasFromCity(center.lat, center.lng);
  const fromPlaces = await buildCityConfigFromPlaces(plan.destination, plan.interests, {
    ...options,
    location,
    youngestChildAge,
    dietaryRestrictions: options.dietaryRestrictions ?? plan.dietaryRestrictions,
  });
  if (fromPlaces) {
    return {
      ...fromPlaces,
      lat: center.lat,
      lng: center.lng,
    };
  }
  return {
    ...detected,
    lat: center.lat,
    lng: center.lng,
  };
}
