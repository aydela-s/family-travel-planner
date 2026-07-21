import { CityConfig, Landmark, LandmarkAgeTag } from "@/config/city-pricing";
import {
  CityRestaurant,
  RestaurantDietary,
  RestaurantMeal,
  restaurantsForCityId,
} from "@/config/city-restaurants";
import { haversineKm } from "@/lib/maps/directions";
import { FamilyAgeProfile, getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { BudgetStyle, TripPlan } from "@/types/trip-plan";

const DIETARY_ALIASES: { tag: RestaurantDietary; patterns: RegExp[] }[] = [
  { tag: "vegan", patterns: [/\bvegan\b/i] },
  { tag: "vegetarian", patterns: [/\bvegetarian\b/i, /\bveggie\b/i] },
  { tag: "gluten-free", patterns: [/\bgluten[-\s]?free\b/i, /\bceliac\b/i] },
  { tag: "dairy-free", patterns: [/\bdairy[-\s]?free\b/i, /\blactose\b/i] },
];

export function parseDietaryTags(dietaryRestrictions: string): RestaurantDietary[] {
  if (!dietaryRestrictions.trim()) return [];
  const found: RestaurantDietary[] = [];
  for (const { tag, patterns } of DIETARY_ALIASES) {
    if (patterns.some((p) => p.test(dietaryRestrictions))) found.push(tag);
  }
  return found;
}

/** Strong fit: every selected dietary need is in the restaurant's primary dietary tags. */
export function matchesDietaryNeeds(
  restaurant: CityRestaurant,
  needed: RestaurantDietary[],
): boolean {
  if (needed.length === 0) return true;
  return needed.every((tag) => primaryCoversTag(restaurant, tag));
}

/**
 * Strong primary fit for a single dietary need.
 *
 * One-way compatibility (not vice versa):
 * - Vegetarian diners may use vegan restaurants
 * - Dairy-free diners may use vegan restaurants
 * - Vegans may NOT use vegetarian-only or dairy-free-only restaurants as a strong fit
 */
function primaryCoversTag(restaurant: CityRestaurant, tag: RestaurantDietary): boolean {
  const tags = restaurant.dietary;
  switch (tag) {
    case "vegan":
      return tags.includes("vegan");
    case "vegetarian":
      return tags.includes("vegetarian") || tags.includes("vegan");
    case "dairy-free":
      return tags.includes("dairy-free") || tags.includes("vegan");
    case "gluten-free":
      return tags.includes("gluten-free");
    default:
      return tags.includes(tag);
  }
}

/**
 * Effective weaker-fit tags: explicit dietaryOptions plus safe implicits.
 * Vegan remains stricter: vegetarian/dairy-free spots only help vegans via
 * explicit vegan options, never as a strong primary match.
 */
export function effectiveDietaryOptions(restaurant: CityRestaurant): Set<RestaurantDietary> {
  const opts = new Set<RestaurantDietary>(restaurant.dietaryOptions ?? []);

  // Vegetarian kitchens (not fully vegan) often have some vegan dishes.
  if (restaurant.dietary.includes("vegetarian") && !restaurant.dietary.includes("vegan")) {
    opts.add("vegan");
  }
  // Plant-based / vegetarian spots usually mark some gluten-free dishes.
  if (
    (restaurant.dietary.includes("vegan") || restaurant.dietary.includes("vegetarian")) &&
    !restaurant.dietary.includes("gluten-free")
  ) {
    opts.add("gluten-free");
  }
  // Non-vegan vegetarian / GF spots often have dairy-free swaps (options tier only).
  if (
    !restaurant.dietary.includes("vegan") &&
    (restaurant.dietary.includes("vegetarian") || restaurant.dietary.includes("gluten-free")) &&
    !restaurant.dietary.includes("dairy-free")
  ) {
    opts.add("dairy-free");
  }

  return opts;
}

/**
 * Weaker fit: every need is covered by primary tags and/or dietary options,
 * but the spot is not a full strong match. Used only after strong-fit places
 * are exhausted.
 *
 * Vegans only land here when a place explicitly has vegan options — never
 * because it is merely vegetarian or dairy-free.
 */
export function matchesDietaryOptions(
  restaurant: CityRestaurant,
  needed: RestaurantDietary[],
): boolean {
  if (needed.length === 0) return false;
  if (matchesDietaryNeeds(restaurant, needed)) return false;
  const options = effectiveDietaryOptions(restaurant);
  return needed.every((tag) => {
    if (primaryCoversTag(restaurant, tag)) return true;
    // Vegetarian diners can also use places that only advertise vegan options.
    if (tag === "vegetarian") return options.has("vegetarian") || options.has("vegan");
    // Dairy-free diners can use places that advertise dairy-free or vegan options.
    if (tag === "dairy-free") return options.has("dairy-free") || options.has("vegan");
    // Vegan diners require vegan (primary already handled) or vegan options — not veg/DF alone.
    if (tag === "vegan") return options.has("vegan");
    return options.has(tag);
  });
}

function familyAgeTags(profile: FamilyAgeProfile): LandmarkAgeTag[] {
  const tags: LandmarkAgeTag[] = [];
  if (profile.hasToddler) tags.push("toddler");
  if (profile.hasYoungChild) tags.push("child");
  if (profile.hasTween) tags.push("tween");
  if (profile.hasTeen) tags.push("teen");
  return tags;
}

function ageScore(restaurant: CityRestaurant, profile: FamilyAgeProfile): number {
  const needed = familyAgeTags(profile);
  if (needed.length === 0) return 8;

  let score = 0;
  for (const tag of needed) {
    if (restaurant.ageTags.includes(tag)) score += 18;
    else if (tag === "toddler" && restaurant.ageTags.includes("child")) score += 6;
    else score -= 4;
  }
  return score;
}

function budgetScore(restaurant: CityRestaurant, style: BudgetStyle | ""): number {
  const effective: BudgetStyle = style || "balanced";
  if (restaurant.budgetStyles.includes(effective)) return 30;
  if (effective === "balanced") return 4;
  if (
    (effective === "save" &&
      restaurant.budgetStyles.includes("splurge") &&
      !restaurant.budgetStyles.includes("balanced")) ||
    (effective === "splurge" &&
      restaurant.budgetStyles.includes("save") &&
      !restaurant.budgetStyles.includes("balanced"))
  ) {
    return -18;
  }
  return -8;
}

function proximityScore(restaurant: CityRestaurant, near: Landmark | null): number {
  if (!near) return 0;
  const km = haversineKm(
    { lat: near.lat, lng: near.lng },
    { lat: restaurant.lat, lng: restaurant.lng },
  );
  if (km <= 1.5) return 14;
  if (km <= 3) return 8;
  if (km <= 6) return 3;
  return -4;
}

export type PickRestaurantOptions = {
  meal: RestaurantMeal;
  day: number;
  near?: Landmark | null;
  /** Names already used this trip — skipped until every qualifying option is exhausted. */
  excludeNames?: Set<string>;
};

function scoreRestaurant(
  restaurant: CityRestaurant,
  plan: TripPlan,
  profile: FamilyAgeProfile,
  near: Landmark | null,
  index: number,
): number {
  return (
    ageScore(restaurant, profile) +
    budgetScore(restaurant, plan.budgetStyle) +
    proximityScore(restaurant, near) +
    ((index + 1) % 7) * 0.01
  );
}

function rankUnused(
  restaurants: CityRestaurant[],
  plan: TripPlan,
  profile: FamilyAgeProfile,
  near: Landmark | null,
  exclude: Set<string>,
): CityRestaurant[] {
  return restaurants
    .map((r, index) => ({
      restaurant: r,
      score: scoreRestaurant(r, plan, profile, near, index),
    }))
    .filter((row) => !exclude.has(row.restaurant.name))
    .sort((a, b) => b.score - a.score || a.restaurant.name.localeCompare(b.restaurant.name))
    .map((row) => row.restaurant);
}

/** Strong-fit restaurants for a meal (primary dietary tags). */
export function qualifyingRestaurantsForMeal(
  city: CityConfig,
  plan: TripPlan,
  meal: RestaurantMeal,
): CityRestaurant[] {
  const dietary = parseDietaryTags(plan.dietaryRestrictions);
  return restaurantsForCityId(city.id).filter(
    (r) => r.meals.includes(meal) && matchesDietaryNeeds(r, dietary),
  );
}

/** Weaker-fit restaurants: have menu options for the need, used after primary is exhausted. */
export function dietaryOptionRestaurantsForMeal(
  city: CityConfig,
  plan: TripPlan,
  meal: RestaurantMeal,
): CityRestaurant[] {
  const dietary = parseDietaryTags(plan.dietaryRestrictions);
  if (dietary.length === 0) return [];
  return restaurantsForCityId(city.id).filter(
    (r) => r.meals.includes(meal) && matchesDietaryOptions(r, dietary),
  );
}

/**
 * Pick a named restaurant for a meal slot.
 * 1) Unused strong dietary matches
 * 2) Unused places that only have dietary *options*
 * 3) Reuse only after both pools are exhausted
 */
export function pickRestaurantForMeal(
  city: CityConfig,
  plan: TripPlan,
  opts: PickRestaurantOptions,
): CityRestaurant | null {
  const primary = qualifyingRestaurantsForMeal(city, plan, opts.meal);
  const secondary = dietaryOptionRestaurantsForMeal(city, plan, opts.meal);
  if (primary.length === 0 && secondary.length === 0) return null;

  const profile = getFamilyAgeProfile(plan);
  const exclude = opts.excludeNames ?? new Set<string>();
  const near = opts.near ?? null;

  const unusedPrimary = rankUnused(primary, plan, profile, near, exclude);
  if (unusedPrimary.length > 0) return unusedPrimary[0]!;

  const unusedSecondary = rankUnused(secondary, plan, profile, near, exclude);
  if (unusedSecondary.length > 0) return unusedSecondary[0]!;

  // Both pools exhausted — rotate reuse across the combined list.
  const combined = [...primary, ...secondary];
  if (combined.length === 0) return null;
  return combined[(Math.max(1, opts.day) - 1) % combined.length]!;
}

export function findRestaurantByName(city: CityConfig, name: string): CityRestaurant | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    restaurantsForCityId(city.id).find((r) => r.name.toLowerCase() === needle) ??
    restaurantsForCityId(city.id).find((r) => needle.includes(r.name.toLowerCase())) ??
    null
  );
}
