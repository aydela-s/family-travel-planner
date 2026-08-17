/**
 * Family-friendly Places filter + type-aware ranking (FAM-60).
 *
 * Pure rules — no network. Block adult/nightlife types, boost family
 * landmark types, keep restaurant pools free of bars/clubs.
 */

/** Places API (New) types that must never enter a family attraction/restaurant pool. */
export const BLOCKED_PLACE_TYPES = new Set([
  "night_club",
  "casino",
  "bar",
  "liquor_store",
  "adult_entertainment",
  "strip_club",
  "gambling_house",
  "wine_bar",
  "pub",
]);

/**
 * Preferred attraction types — higher weight in ranking when present.
 * Values are additive boosts on top of rating × log(reviews).
 */
export const PREFERRED_ATTRACTION_TYPES: Record<string, number> = {
  zoo: 2.5,
  aquarium: 2.5,
  amusement_park: 2.4,
  park: 2.2,
  playground: 2.2,
  museum: 2.0,
  tourist_attraction: 1.6,
  botanical_garden: 2.0,
  national_park: 2.2,
  state_park: 2.0,
  historical_landmark: 1.4,
  cultural_landmark: 1.4,
  performing_arts_theater: 0.4,
  art_gallery: 1.2,
  "children's_museum": 2.5,
  shopping_mall: 2.2,
  department_store: 1.6,
};

/** Preferred dining types for the restaurant pool. */
export const PREFERRED_RESTAURANT_TYPES: Record<string, number> = {
  restaurant: 2.0,
  cafe: 1.6,
  bakery: 1.4,
  meal_takeaway: 1.2,
  ice_cream_shop: 1.4,
  pizza_restaurant: 1.8,
  sandwich_shop: 1.2,
  coffee_shop: 1.2,
  brunch_restaurant: 1.6,
  family_restaurant: 2.2,
};

/** Name patterns that signal unsuitable venues when types are missing/incomplete. */
const BLOCKED_NAME_PATTERN =
  /\b(night\s*club|nightclub|strip\s*club|gentlemen'?s?\s*club|adult\s*(entertainment|theater|theatre|bookstore)|casino|hookah|speakeasy|dive\s*bar|sports\s*bar|wine\s*bar|liquor\s*store|shot\s*bar|cocktail\s*bar)\b/i;

/**
 * Observation decks / sky towers — long trips for little payoff with young kids
 * (Dallas Reunion Tower is the canonical miss).
 */
const OBSERVATION_TOWER_NAME =
  /\b(reunion\s+tower|observation\s+(deck|tower|lounge)|sky\s*deck|skydeck|space\s*needle|cn\s*tower|willis\s*tower|sears\s*tower|edge\s+(nyc|new\s+york)|summit\s+one\s+vanderbilt|eureka\s+tower)\b/i;

export type FamilyPlaceKind = "attraction" | "restaurant";

export function isRestaurantSearchCategory(category: string): boolean {
  return /\b(restaurant|restaurants|dining|food|cafe|cafes|brunch|eatery)\b/i.test(
    category.trim(),
  );
}

export function placeKindForCategory(category: string): FamilyPlaceKind {
  return isRestaurantSearchCategory(category) ? "restaurant" : "attraction";
}

export function normalizePlaceTypes(
  types: string[] | undefined,
  primaryType?: string | null,
): string[] {
  const out = new Set<string>();
  if (primaryType?.trim()) out.add(primaryType.trim());
  for (const t of types ?? []) {
    const trimmed = t.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out];
}

export function hasBlockedPlaceType(types: string[]): boolean {
  return types.some((t) => BLOCKED_PLACE_TYPES.has(t));
}

export function hasBlockedPlaceName(name: string): boolean {
  return BLOCKED_NAME_PATTERN.test(name) || OBSERVATION_TOWER_NAME.test(name);
}

/** True when this place must be excluded from the family pool. */
export function isBlockedFamilyPlace(opts: {
  name: string;
  types?: string[];
  primaryType?: string | null;
}): boolean {
  const types = normalizePlaceTypes(opts.types, opts.primaryType);
  if (hasBlockedPlaceType(types)) return true;
  if (hasBlockedPlaceName(opts.name)) return true;
  return false;
}

function preferredBoost(types: string[], kind: FamilyPlaceKind): number {
  const table =
    kind === "restaurant" ? PREFERRED_RESTAURANT_TYPES : PREFERRED_ATTRACTION_TYPES;
  let best = 0;
  for (const t of types) {
    const boost = table[t];
    if (typeof boost === "number" && boost > best) best = boost;
  }
  return best;
}

/**
 * Rating × log(reviews) plus a deterministic type preference boost.
 * Same inputs always produce the same score.
 */
export function familyPlaceScore(opts: {
  rating: number;
  reviewCount: number;
  types?: string[];
  primaryType?: string | null;
  kind?: FamilyPlaceKind;
}): number {
  const base = opts.rating * Math.log(opts.reviewCount + 1);
  const types = normalizePlaceTypes(opts.types, opts.primaryType);
  const boost = preferredBoost(types, opts.kind ?? "attraction");
  return base + boost;
}

export function preferredTypeBoost(
  types: string[] | undefined,
  primaryType: string | null | undefined,
  kind: FamilyPlaceKind = "attraction",
): number {
  return preferredBoost(normalizePlaceTypes(types, primaryType), kind);
}

const BAKERY_NAME =
  /\b(bakeshop|bake\s*shop|bakery|patisserie|boulangerie|donut|doughnut|coffee\s*(shop|house|bar)|espresso)\b/i;

const BREAKFAST_ONLY_TYPES = new Set(["bakery", "coffee_shop", "donut_shop"]);
const BREAKFAST_LUNCH_TYPES = new Set([
  "cafe",
  "breakfast_restaurant",
  "brunch_restaurant",
  "tea_house",
]);
const LUNCH_SNACK_TYPES = new Set(["ice_cream_shop", "sandwich_shop", "meal_takeaway"]);
const SIT_DOWN_TYPES = new Set([
  "restaurant",
  "family_restaurant",
  "pizza_restaurant",
  "hamburger_restaurant",
  "mexican_restaurant",
  "american_restaurant",
  "italian_restaurant",
  "seafood_restaurant",
  "steak_house",
  "barbecue_restaurant",
  "meal_delivery",
]);

/** True for bakeries / coffee counters that are not a sit-down dinner. */
export function isBakeryStyleVenue(opts: {
  name: string;
  types?: string[];
  primaryType?: string | null;
}): boolean {
  if (BAKERY_NAME.test(opts.name)) return true;
  const types = normalizePlaceTypes(opts.types, opts.primaryType);
  if (types.some((t) => SIT_DOWN_TYPES.has(t))) return false;
  return types.some((t) => BREAKFAST_ONLY_TYPES.has(t) || t === "cafe");
}

/**
 * Which itinerary meals a Places dining spot can fill. Bakeries and coffee
 * shops must not land on dinner.
 */
export function mealsServedByPlace(opts: {
  name: string;
  types?: string[];
  primaryType?: string | null;
}): Array<"breakfast" | "lunch" | "dinner"> {
  const types = normalizePlaceTypes(opts.types, opts.primaryType);
  const bakeryName = BAKERY_NAME.test(opts.name);
  const breakfastOnly = bakeryName || types.some((t) => BREAKFAST_ONLY_TYPES.has(t));
  const sitDown = types.some((t) => SIT_DOWN_TYPES.has(t));
  const breakfastLunch = types.some((t) => BREAKFAST_LUNCH_TYPES.has(t));
  const snack = types.some((t) => LUNCH_SNACK_TYPES.has(t));

  if (breakfastOnly && !sitDown) return ["breakfast"];
  if ((breakfastLunch || snack) && !sitDown) {
    return breakfastLunch ? ["breakfast", "lunch"] : ["lunch"];
  }
  if (sitDown && (breakfastLunch || types.includes("breakfast_restaurant"))) {
    return ["breakfast", "lunch", "dinner"];
  }
  return ["lunch", "dinner"];
}
