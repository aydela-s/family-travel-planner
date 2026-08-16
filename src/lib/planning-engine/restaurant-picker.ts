import { CityConfig, Landmark, LandmarkAgeTag } from "@/config/city-pricing";
import {
  CityRestaurant,
  RestaurantDietary,
  RestaurantMeal,
  restaurantsForCity,
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

function proximityScore(
  restaurant: CityRestaurant,
  near: Landmark | null,
  prioritizeNearby: boolean,
): number {
  if (!near) return 0;
  const km = haversineKm(near.lat, near.lng, restaurant.lat, restaurant.lng);
  const boost = prioritizeNearby ? 2 : 1;
  if (km <= 1.5) return 14 * boost;
  if (km <= 3) return 8 * boost;
  if (km <= 6) return 3 * boost;
  return -4 * boost;
}

function ratingScore(restaurant: CityRestaurant, prioritizeRating: boolean): number {
  if (!prioritizeRating) return 0;
  const rating = restaurant.rating ?? 4.2;
  return Math.round((rating - 4) * 50);
}

export type PickRestaurantOptions = {
  meal: RestaurantMeal;
  day: number;
  near?: Landmark | null;
  /** Names already used this trip — skipped until every qualifying option is exhausted. */
  excludeNames?: Set<string>;
  /** Stop the family is coming from when heading to this meal. */
  routeFrom?: Landmark | null;
  /** Stop they continue to afterwards — makes the meal a waypoint, not a detour. */
  routeTo?: Landmark | null;
};

/**
 * How far off the day's route a meal may sit, by getting-around mode. Extra
 * driving to satisfy a dietary preference is capped here: a vegan restaurant is
 * never worth an hour of backtracking with kids in the car.
 */
export function mealDetourLimits(
  plan: Pick<TripPlan, "transportationType">,
): { preferredKm: number; maxKm: number } {
  switch (plan.transportationType) {
    case "walking":
      return { preferredKm: 1, maxKm: 2 };
    case "public-transportation":
      return { preferredKm: 2.5, maxKm: 5 };
    case "car-rental":
      return { preferredKm: 5, maxKm: 12 };
    default:
      return { preferredKm: 3, maxKm: 6 };
  }
}

/** Two stops closer than this are the same place for routing purposes. */
const SAME_PLACE_KM = 0.3;

/**
 * Extra distance the meal adds to the day's geographic flow. A restaurant
 * directly between two stops scores ~0; one that needs a there-and-back
 * detour scores the full round trip.
 */
export function mealDetourKm(
  restaurant: Pick<CityRestaurant, "lat" | "lng">,
  route: { from?: Landmark | null; to?: Landmark | null },
): number {
  const from = route.from ?? null;
  const to = route.to ?? null;
  // Both ends at the same place (e.g. dinner between the last stop and an
  // unknown stay) is a single hop, not a there-and-back detour.
  const sameEnds =
    from && to && haversineKm(from.lat, from.lng, to.lat, to.lng) < SAME_PLACE_KM;
  if (from && to && !sameEnds) {
    const viaMeal =
      haversineKm(from.lat, from.lng, restaurant.lat, restaurant.lng) +
      haversineKm(restaurant.lat, restaurant.lng, to.lat, to.lng);
    const direct = haversineKm(from.lat, from.lng, to.lat, to.lng);
    return Math.max(0, viaMeal - direct);
  }
  const anchor = from ?? to;
  if (!anchor) return 0;
  return haversineKm(anchor.lat, anchor.lng, restaurant.lat, restaurant.lng);
}

/** How well a pick satisfies the family's dietary needs. */
export type DietaryFit = "strong" | "options" | "unverified" | "none";

/**
 * Extra driving a better dietary fit is worth once nothing sits on the route.
 * A dedicated vegan kitchen buys 4 km; beyond that the closer table wins.
 */
/**
 * Score points a kilometre of extra driving costs. Set above the budget-style
 * and rating weights so distance decides between far and near options, while
 * options a few hundred metres apart are still separated by fit.
 */
const DETOUR_PENALTY_PER_KM = 12;

const DIETARY_DETOUR_ALLOWANCE_KM: Record<DietaryFit, number> = {
  strong: 0,
  options: 2,
  unverified: 4,
  none: 6,
};

export type RestaurantPick = {
  restaurant: CityRestaurant;
  dietaryFit: DietaryFit;
  /** Extra km this meal adds to the day's route. */
  detourKm: number;
};

function scoreRestaurant(
  restaurant: CityRestaurant,
  plan: TripPlan,
  profile: FamilyAgeProfile,
  near: Landmark | null,
  index: number,
): number {
  const noDiet = parseDietaryTags(plan.dietaryRestrictions).length === 0;
  return (
    ageScore(restaurant, profile) +
    budgetScore(restaurant, plan.budgetStyle) +
    // Geography is enforced structurally by the detour rings below, so scoring
    // keeps its original weighting here.
    proximityScore(restaurant, near, noDiet) +
    ratingScore(restaurant, noDiet) +
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
  return restaurantsForCity(city).filter(
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
  return restaurantsForCity(city).filter(
    (r) => r.meals.includes(meal) && matchesDietaryOptions(r, dietary),
  );
}

/** Every restaurant that serves this meal, dietary fit aside. */
function allRestaurantsForMeal(city: CityConfig, meal: RestaurantMeal): CityRestaurant[] {
  return restaurantsForCity(city).filter((r) => r.meals.includes(meal));
}

/**
 * Pick a named restaurant for a meal slot, judged against the whole day's route
 * rather than each meal in isolation.
 *
 * Priority inside the preferred detour ring, then the same order inside the
 * hard maximum ring:
 *   1. strong dietary match
 *   2. place with dietary *options*
 *   3. any nearby family restaurant, flagged so the user checks the menu
 *
 * A close regular restaurant beats a far dietary-perfect one: a vegan kitchen is
 * never worth a large detour. Restaurants in excludeNames are never reused —
 * the meal falls back to casual / picnic copy instead.
 */
export function pickRestaurantWithRoute(
  city: CityConfig,
  plan: TripPlan,
  opts: PickRestaurantOptions,
): RestaurantPick | null {
  const dietary = parseDietaryTags(plan.dietaryRestrictions);
  const primary = qualifyingRestaurantsForMeal(city, plan, opts.meal);
  const secondary = dietaryOptionRestaurantsForMeal(city, plan, opts.meal);
  const general = dietary.length > 0 ? allRestaurantsForMeal(city, opts.meal) : [];
  if (primary.length === 0 && secondary.length === 0) return null;

  const profile = getFamilyAgeProfile(plan);
  const exclude = opts.excludeNames ?? new Set<string>();
  const near = opts.near ?? null;
  const route = { from: opts.routeFrom ?? near, to: opts.routeTo ?? null };
  // Detour rings need a real leg to measure against. With only a single anchor
  // (no routeFrom/routeTo) proximity is handled by the score instead.
  const hasRoute = Boolean(opts.routeFrom || opts.routeTo);
  const { preferredKm, maxKm } = mealDetourLimits(plan);

  const tiers: Array<{ pool: CityRestaurant[]; fit: DietaryFit }> = [
    { pool: primary, fit: "strong" },
    { pool: secondary, fit: "options" },
    { pool: general, fit: "unverified" },
  ];

  const pickWithin = (limitKm: number | null): RestaurantPick | null => {
    for (const tier of tiers) {
      if (tier.pool.length === 0) continue;
      const ranked = rankUnused(tier.pool, plan, profile, near, exclude).filter(
        (r) => limitKm == null || mealDetourKm(r, route) <= limitKm,
      );
      if (ranked.length === 0) continue;
      // Inside a ring, trade fit against driving: every extra km costs more than
      // budget or rating can win back, so the zig-zag options lose, while
      // similarly-close options are still separated by fit.
      const value = (r: CityRestaurant, index: number) =>
        scoreRestaurant(r, plan, profile, near, index) -
        mealDetourKm(r, route) * DETOUR_PENALTY_PER_KM;
      const best = ranked.reduce((a, b) =>
        value(b, ranked.indexOf(b)) > value(a, ranked.indexOf(a)) ? b : a,
      );
      return { restaurant: best, dietaryFit: tier.fit, detourKm: mealDetourKm(best, route) };
    }
    return null;
  };

  if (hasRoute) {
    const nearby = pickWithin(preferredKm) ?? pickWithin(maxKm);
    if (nearby) return nearby;

    // Nothing in the rings: take the shortest drive, allowing a little extra
    // for a better dietary fit rather than crossing the metro for one. Past the
    // outer ceiling we return nothing — the meal becomes casual copy near the
    // day's stops instead of an hour in the car for a name.
    const candidates = tiers
      .flatMap((tier) =>
        rankUnused(tier.pool, plan, profile, near, exclude).map((restaurant) => ({
          restaurant,
          fit: tier.fit,
          detourKm: mealDetourKm(restaurant, route),
        })),
      )
      .filter((c) => c.detourKm <= maxKm);
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) =>
        b.detourKm + DIETARY_DETOUR_ALLOWANCE_KM[b.fit] <
        a.detourKm + DIETARY_DETOUR_ALLOWANCE_KM[a.fit]
          ? b
          : a,
      );
      return { restaurant: best.restaurant, dietaryFit: best.fit, detourKm: best.detourKm };
    }
    return null;
  }

  // No route context to judge against: fall back to dietary fit only.
  for (const tier of tiers) {
    if (tier.fit === "unverified") continue;
    const ranked = rankUnused(tier.pool, plan, profile, near, exclude);
    if (ranked.length === 0) continue;
    const best = ranked[0]!;
    return {
      restaurant: best,
      dietaryFit: tier.fit,
      detourKm: mealDetourKm(best, route),
    };
  }
  return null;
}

/** Restaurant-only view of pickRestaurantWithRoute. */
export function pickRestaurantForMeal(
  city: CityConfig,
  plan: TripPlan,
  opts: PickRestaurantOptions,
): CityRestaurant | null {
  return pickRestaurantWithRoute(city, plan, opts)?.restaurant ?? null;
}

export function findRestaurantByName(city: CityConfig, name: string): CityRestaurant | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    restaurantsForCity(city).find((r) => r.name.toLowerCase() === needle) ??
    restaurantsForCity(city).find((r) => needle.includes(r.name.toLowerCase())) ??
    null
  );
}
