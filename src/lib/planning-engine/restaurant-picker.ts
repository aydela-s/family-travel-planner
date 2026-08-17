import { CityConfig, Landmark, LandmarkAgeTag } from "@/config/city-pricing";
import {
  CityRestaurant,
  RestaurantDietary,
  RestaurantMeal,
  restaurantsForCity,
} from "@/config/city-restaurants";
import { haversineKm } from "@/lib/maps/directions";
import { isBakeryStyleVenue } from "@/lib/maps/family-friendly-places";
import { pureTravelMin } from "@/lib/maps/travel-estimate";
import {
  compileTripConstraints,
  describeHardConstraint,
  excludedVenueNames,
  findHardConstraint,
  matchesExcludedVenue,
  maxDriveMin,
  requiredDietaryTags,
  type HardRuleKind,
  type TripConstraints,
} from "@/lib/planning-engine/constraints";
import {
  recordConflict,
  type ConflictOption,
  type ConflictSlot,
  type PlannerConflict,
} from "@/lib/planning-engine/conflicts";
import { parseDietaryTags } from "@/lib/planning-engine/dietary";
import { violatesAgeRestriction } from "@/lib/planning-engine/staged/eligibility";
import { isKnownClosedForVisit, type VisitWindow } from "@/lib/schedule/landmark-hours";
import { FamilyAgeProfile, getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { BudgetStyle, TripPlan } from "@/types/trip-plan";

export { parseDietaryTags } from "@/lib/planning-engine/dietary";

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
  /**
   * When true (dinner), never fall back to "Dinner near stay": pick the closest
   * unused restaurant even if it sits outside the preferred detour ring.
   */
  forcePick?: boolean;
  /** When the family would sit down — skips restaurants known to be closed. */
  visitWindow?: VisitWindow;
  /** Compiled user constraints; derived from the plan when omitted. */
  constraints?: TripConstraints;
  /** Sink for hard requirements this meal could not satisfy. */
  conflicts?: PlannerConflict[];
};

/** Why a restaurant is unusable. Hard rules only — fit and distance are scored. */
type RestaurantRejection = { rule: HardRuleKind; reason: string };

/**
 * HARD gate for a restaurant: explicit exclusions, enforced age limits, and
 * reliable closed hours. Dietary fit and detour stay in the ranking below.
 */
function restaurantRejection(
  restaurant: CityRestaurant,
  plan: TripPlan,
  opts: { constraints: TripConstraints; visitWindow?: VisitWindow },
): RestaurantRejection | null {
  if (matchesExcludedVenue(restaurant.name, excludedVenueNames(opts.constraints))) {
    return {
      rule: "exclude_venue",
      reason: `"${restaurant.name}" is on the excluded list`,
    };
  }
  if (violatesAgeRestriction(restaurant, plan)) {
    return {
      rule: "age_restriction",
      reason: `"${restaurant.name}" does not admit every child in the family`,
    };
  }
  if (opts.visitWindow && isKnownClosedForVisit(restaurant, opts.visitWindow)) {
    return {
      rule: "venue_closed",
      reason: `"${restaurant.name}" is closed at the planned meal time`,
    };
  }
  return null;
}

/** Extra driving minutes the meal adds to the day's route. */
export function mealDetourMin(
  restaurant: Pick<CityRestaurant, "lat" | "lng">,
  route: { from?: Landmark | null; to?: Landmark | null },
  plan: Pick<TripPlan, "transportationType">,
): number {
  const from = route.from ?? null;
  const to = route.to ?? null;
  const sameEnds =
    from && to && haversineKm(from.lat, from.lng, to.lat, to.lng) < SAME_PLACE_KM;
  if (from && to && !sameEnds) {
    const viaMeal =
      pureTravelMin(from, restaurant, plan) + pureTravelMin(restaurant, to, plan);
    return Math.max(0, viaMeal - pureTravelMin(from, to, plan));
  }
  const anchor = from ?? to;
  if (!anchor) return 0;
  return pureTravelMin(anchor, restaurant, plan);
}

const MEAL_SLOT: Record<RestaurantMeal, ConflictSlot> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
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
    (r) =>
      r.meals.includes(meal) &&
      !(meal === "dinner" && isBakeryStyleVenue({ name: r.name })) &&
      matchesDietaryNeeds(r, dietary),
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
    (r) =>
      r.meals.includes(meal) &&
      !(meal === "dinner" && isBakeryStyleVenue({ name: r.name })) &&
      matchesDietaryOptions(r, dietary),
  );
}

/** Every restaurant that serves this meal, dietary fit aside. */
function allRestaurantsForMeal(city: CityConfig, meal: RestaurantMeal): CityRestaurant[] {
  return restaurantsForCity(city).filter(
    (r) =>
      r.meals.includes(meal) &&
      !(meal === "dinner" && isBakeryStyleVenue({ name: r.name })),
  );
}

/**
 * Report a meal slot where a hard requirement made every restaurant unusable.
 * Lists the real alternatives with what each one would break, so a later
 * "Adjust this day" turn can offer the trade-off instead of guessing.
 */
function recordUnsatisfiedMealConstraint(args: {
  city: CityConfig;
  plan: TripPlan;
  opts: PickRestaurantOptions;
  constraints: TripConstraints;
  strictDietary: RestaurantDietary[];
  driveLimitMin: number | null;
  pools: { primary: CityRestaurant[]; secondary: CityRestaurant[]; general: CityRestaurant[] };
  rejected: Array<{ restaurant: CityRestaurant; rejection: RestaurantRejection }>;
  detourMin: (r: CityRestaurant) => number;
}): void {
  const { opts, plan, strictDietary, driveLimitMin, pools, rejected, detourMin } = args;
  if (!opts.conflicts) return;

  const strictConstraint = findHardConstraint(args.constraints, "dietary_required");
  const driveConstraint = findHardConstraint(args.constraints, "max_drive_min");

  const option = (
    restaurant: CityRestaurant,
    fit: DietaryFit,
    violates: HardRuleKind[],
    reason: string,
  ): ConflictOption => ({
    kind: "restaurant",
    name: restaurant.name,
    placeId: restaurant.placeId,
    dietaryFit: fit,
    extraDriveMin: detourMin(restaurant),
    detourKm: Math.round(mealDetourKm(restaurant, { from: opts.routeFrom ?? opts.near, to: opts.routeTo }) * 10) / 10,
    violates,
    reason,
  });

  const options: ConflictOption[] = [];
  const byDrive = (a: CityRestaurant, b: CityRestaurant) => detourMin(a) - detourMin(b);

  // A dedicated venue that exists but sits beyond the drive limit.
  for (const restaurant of [...pools.primary].sort(byDrive).slice(0, 2)) {
    if (driveLimitMin != null && detourMin(restaurant) > driveLimitMin) {
      options.push(
        option(restaurant, "strong", ["max_drive_min"], `${detourMin(restaurant)} min of extra driving exceeds the ${driveLimitMin} min limit`),
      );
    }
  }
  // A close venue that only has suitable options rather than a dedicated menu.
  if (strictDietary.length > 0) {
    for (const restaurant of [...pools.secondary, ...pools.general].sort(byDrive).slice(0, 2)) {
      options.push(
        option(
          restaurant,
          pools.secondary.includes(restaurant) ? "options" : "unverified",
          ["dietary_required"],
          `${restaurant.name} is ${detourMin(restaurant)} min away but is not fully ${strictDietary.join(" / ")}`,
        ),
      );
    }
  }
  for (const { restaurant, rejection } of rejected.slice(0, 2)) {
    options.push(option(restaurant, "none", [rejection.rule], rejection.reason));
  }

  if (options.length === 0) return;

  const rule: HardRuleKind =
    strictDietary.length > 0
      ? "dietary_required"
      : driveLimitMin != null
        ? "max_drive_min"
        : rejected[0]!.rejection.rule;
  const constraint = strictDietary.length > 0 ? strictConstraint : driveConstraint;

  recordConflict(opts.conflicts, {
    code:
      rule === "dietary_required"
        ? "dietary_unreachable"
        : rule === "max_drive_min"
          ? "drive_limit_exceeded"
          : rule === "venue_closed"
            ? "no_open_venue"
            : rule === "age_restriction"
              ? "no_age_appropriate_venue"
              : "exclusion_leaves_nothing",
    rule,
    constraint: constraint ?? undefined,
    scope: { day: opts.day, slot: MEAL_SLOT[opts.meal] },
    message: constraint
      ? `Day ${opts.day} ${opts.meal}: no restaurant satisfies "${describeHardConstraint(constraint)}".`
      : `Day ${opts.day} ${opts.meal}: no restaurant meets every requirement.`,
    options,
  });
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
  const constraints = opts.constraints ?? compileTripConstraints(plan);
  const strictDietary = requiredDietaryTags(constraints);
  const driveLimitMin = maxDriveMin(constraints);

  // HARD gate before ranking. Rejections are kept so an unsatisfiable
  // requirement can name the real alternatives it turned down.
  const rejected: Array<{ restaurant: CityRestaurant; rejection: RestaurantRejection }> = [];
  const allowed = (pool: CityRestaurant[]): CityRestaurant[] =>
    pool.filter((r) => {
      const rejection = restaurantRejection(r, plan, {
        constraints,
        visitWindow: opts.visitWindow,
      });
      if (!rejection) return true;
      if (!rejected.some((x) => x.restaurant.name === r.name)) {
        rejected.push({ restaurant: r, rejection });
      }
      return false;
    });

  const primary = allowed(qualifyingRestaurantsForMeal(city, plan, opts.meal));
  const secondary = allowed(dietaryOptionRestaurantsForMeal(city, plan, opts.meal));
  const general = allowed(
    dietary.length > 0 || opts.forcePick ? allRestaurantsForMeal(city, opts.meal) : [],
  );

  const profile = getFamilyAgeProfile(plan);
  const exclude = opts.excludeNames ?? new Set<string>();
  const near = opts.near ?? null;
  const route = { from: opts.routeFrom ?? near, to: opts.routeTo ?? null };
  // Detour rings need a real leg to measure against. With only a single anchor
  // (no routeFrom/routeTo) proximity is handled by the score instead.
  const hasRoute = Boolean(opts.routeFrom || opts.routeTo);
  const { preferredKm, maxKm } = mealDetourLimits(plan);

  const detourMin = (r: CityRestaurant) => mealDetourMin(r, route, plan);
  const withinDriveLimit = (r: CityRestaurant) =>
    driveLimitMin == null || detourMin(r) <= driveLimitMin;

  // "Vegan only" / "must be fully vegan" is a hard requirement: nothing weaker
  // than a dedicated kitchen qualifies, and the limit is never widened silently.
  const tiers: Array<{ pool: CityRestaurant[]; fit: DietaryFit }> =
    strictDietary.length > 0
      ? [{ pool: primary.filter(withinDriveLimit), fit: "strong" }]
      : [
          { pool: primary.filter(withinDriveLimit), fit: "strong" },
          { pool: secondary.filter(withinDriveLimit), fit: "options" },
          { pool: general.filter(withinDriveLimit), fit: "unverified" },
        ];

  if (tiers.every((t) => t.pool.length === 0)) {
    recordUnsatisfiedMealConstraint({
      city,
      plan,
      opts,
      constraints,
      strictDietary,
      driveLimitMin,
      pools: { primary, secondary, general },
      rejected,
      detourMin,
    });
    return null;
  }

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
    // for a better dietary fit rather than crossing the metro for one.
    const candidates = tiers
      .flatMap((tier) =>
        rankUnused(tier.pool, plan, profile, near, exclude).map((restaurant) => ({
          restaurant,
          fit: tier.fit,
          detourKm: mealDetourKm(restaurant, route),
        })),
      )
      .filter((c) => opts.forcePick || c.detourKm <= maxKm);
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
