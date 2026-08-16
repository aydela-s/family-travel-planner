import type { CityConfig, Landmark } from "@/config/city-pricing";
import type { CityRestaurant } from "@/config/city-restaurants";
import { restaurantsForCity } from "@/config/city-restaurants";
import {
  breakfastLabel,
  dinnerLabel,
  lunchLabel,
  napOverlapsLunchWindow,
  onSiteCafeLabel,
  requiresBreakfastSlot,
  shouldAutoScheduleRestaurantDinner,
  shouldCookDinnerAtHome,
  shouldFoldLunchIntoDay1Grocery,
  usesNamedRestaurant,
} from "@/lib/planning-engine/meal-planner";
import {
  findRestaurantByName,
  parseDietaryTags,
  pickRestaurantWithRoute,
} from "@/lib/planning-engine/restaurant-picker";
import type {
  DayBlueprint,
  MealIntent,
  MealSlotKind,
  TripBlueprint,
} from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";
import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import { isThemeParkExperience } from "@/lib/planning-engine/staged/landmark-experience";

function findLandmark(city: CityConfig, name: string | undefined): Landmark | null {
  if (!name) return null;
  return city.landmarks.find((l) => l.name === name) ?? null;
}

function stayLandmark(plan: TripPlan): Landmark | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return {
    name: (plan.stayAddress ?? "").trim() || "Your stay",
    lat: plan.stayLat,
    lng: plan.stayLng,
    adultPrice: 0,
    intensity: "low",
    ageTags: ["toddler", "child", "tween", "teen"],
    interestTags: [],
    indoor: true,
    openingHours: { open: "00:00", close: "23:59" },
  };
}

function landmarkWithOnSiteMeal(
  landmarks: Landmark[],
  meal: MealSlotKind,
): Landmark | null {
  for (const landmark of landmarks) {
    if (landmark.onSiteMeals?.includes(meal)) return landmark;
  }
  return null;
}

/** Mirror slot-filler: on-site café only when we are not naming a restaurant / dietary. */
function shouldPreferOnSiteCafe(plan: TripPlan, meal: MealSlotKind): boolean {
  if (parseDietaryTags(plan.dietaryRestrictions).length > 0) return false;
  if (usesNamedRestaurant(plan, meal)) return false;
  if (meal === "dinner" && plan.budgetStyle === "save") return false;
  if (meal === "lunch" && plan.accommodationType === "airbnb_with_kitchen" && plan.budgetStyle === "save") {
    return false;
  }
  return true;
}

function cityHasRestaurant(city: CityConfig, name: string): boolean {
  return restaurantsForCity(city).some((r) => r.name === name);
}

/**
 * The leg a meal sits on: where the family eats between, so a restaurant that is
 * roughly on the way costs no extra driving.
 * Breakfast starts at the stay; dinner ends back at the stay when known.
 */
function mealRouteContext(
  slot: MealSlotKind,
  anchor: Landmark | null,
  support: Landmark[],
  near: Landmark | null,
  plan: TripPlan,
): { from: Landmark | null; to: Landmark | null } {
  const stay = stayLandmark(plan);
  const morning = support[0] ?? anchor;
  switch (slot) {
    case "breakfast":
      return { from: stay ?? morning ?? near, to: morning ?? anchor ?? near };
    case "lunch":
      return { from: morning ?? near, to: anchor ?? near };
    case "dinner":
      return { from: anchor ?? near, to: stay ?? near };
  }
}

function planSlotMeal(
  slot: MealSlotKind,
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
  anchor: Landmark | null,
  support: Landmark[],
  usedRestaurants: Set<string>,
): MealIntent | null {
  if (slot === "breakfast" && !requiresBreakfastSlot(plan)) return null;

  // With naps the family returns home midday — dinner near stay unless the day
  // is a theme-park exclusive (family stays at the park into the evening).
  const dinnerNearStay =
    slot === "dinner" &&
    shouldIncludeNaps(plan) &&
    !(anchor && isThemeParkExperience(anchor));
  const near =
    slot === "breakfast"
      ? (support[0] ?? anchor)
      : dinnerNearStay
        ? stayLandmark(plan)
        : anchor;

  if (slot === "dinner" && plan.accommodationType === "staying_with_family_or_friends") {
    return { slot, mode: "cook_at_home", nearLandmarkName: near?.name };
  }

  if (slot === "lunch" && shouldFoldLunchIntoDay1Grocery(plan, day.dayIndex)) {
    return null;
  }

  if (slot === "lunch" && napOverlapsLunchWindow(plan)) {
    return {
      slot,
      mode: "takeout_at_stay",
      nearLandmarkName: near?.name,
    };
  }

  if (slot === "dinner" && shouldCookDinnerAtHome(plan, day.dayIndex)) {
    return { slot, mode: "cook_at_home", nearLandmarkName: near?.name };
  }

  const onSiteCandidates =
    slot === "lunch"
      ? ([...support, ...(anchor ? [anchor] : [])] as Landmark[])
      : slot === "dinner"
        ? ([...(anchor ? [anchor] : []), ...support] as Landmark[])
        : ([...(support[0] ? [support[0]] : []), ...(anchor ? [anchor] : [])] as Landmark[]);

  if (shouldPreferOnSiteCafe(plan, slot)) {
    const onSite = landmarkWithOnSiteMeal(onSiteCandidates, slot);
    if (onSite) {
      return {
        slot,
        mode: "on_site",
        nearLandmarkName: onSite.name,
      };
    }
  }

  const wantNamed =
    usesNamedRestaurant(plan, slot) ||
    (slot === "dinner" && shouldAutoScheduleRestaurantDinner(plan));

  if (wantNamed) {
    // Judge the restaurant against the leg it sits on, not just one landmark,
    // so lunch/dinner stay on the day's geographic flow.
    const route = mealRouteContext(slot, anchor, support, near, plan);
    const pick = pickRestaurantWithRoute(city, plan, {
      meal: slot,
      day: day.dayIndex,
      near,
      excludeNames: usedRestaurants,
      routeFrom: route.from,
      routeTo: route.to,
    });
    if (pick && cityHasRestaurant(city, pick.restaurant.name)) {
      usedRestaurants.add(pick.restaurant.name);
      return {
        slot,
        mode: "named_restaurant",
        restaurantName: pick.restaurant.name,
        nearLandmarkName: near?.name,
        dietaryFit: pick.dietaryFit,
        detourKm: Math.round(pick.detourKm * 10) / 10,
      };
    }
  }

  // Wanted a name but every option was either used or a long drive away: eat
  // near the day's stops and tell the family what to look for there.
  const unmetDietary =
    wantNamed && parseDietaryTags(plan.dietaryRestrictions).length > 0
      ? ({ dietaryFit: "none" } as const)
      : {};

  if (slot === "breakfast") {
    return { slot, mode: "bakery_casual", nearLandmarkName: near?.name, ...unmetDietary };
  }
  if (slot === "lunch") {
    // Kitchen + save packs from the rental; other kitchen budgets eat lunch out upstream.
    return { slot, mode: "picnic", nearLandmarkName: near?.name, ...unmetDietary };
  }
  // No curated restaurants for this city — stay-area dinner (never NYC default fakes).
  return { slot, mode: "picnic", nearLandmarkName: near?.name, ...unmetDietary };
}

/** Plan meal intents for one day; mutates usedRestaurants for trip uniqueness. */
export function planMealsForDay(
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
  usedRestaurants: Set<string>,
): MealIntent[] {
  const anchor = findLandmark(city, day.anchor?.landmarkName);
  const support = day.support
    .map((s) => findLandmark(city, s.landmarkName))
    .filter((l): l is Landmark => Boolean(l));

  const slots: MealSlotKind[] = ["breakfast", "lunch", "dinner"];
  const meals: MealIntent[] = [];
  for (const slot of slots) {
    const intent = planSlotMeal(slot, day, plan, city, anchor, support, usedRestaurants);
    if (intent) meals.push(intent);
  }
  return meals;
}

/**
 * Write MealIntent[] onto every day from PlanningRules + committed stops.
 * Restaurant picks are city-bound and trip-unique via the ledger.
 */
export function planMealsOnBlueprint(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
): TripBlueprint {
  const usedRestaurants = new Set(blueprint.ledger.restaurantNames);
  const days = blueprint.days.map((day) => ({
    ...day,
    meals: planMealsForDay(day, plan, city, usedRestaurants),
  }));

  return {
    ...blueprint,
    days,
    ledger: {
      ...blueprint.ledger,
      restaurantNames: [...usedRestaurants],
    },
  };
}

/** Resolve display title/notes for a committed meal intent (no restaurant re-pick). */
export function labelForMealIntent(
  intent: MealIntent,
  plan: TripPlan,
  city: CityConfig,
  dayIndex: number,
  spotName: string,
): { title: string; notes: string } {
  // Placement knows the real morning/lunch/dinner stop. Meal-plan
  // nearLandmarkName can be stale (e.g. breakfast near the afternoon mall
  // before a soft-filler morning companion was chosen).
  if (intent.mode === "on_site" && intent.nearLandmarkName) {
    return onSiteCafeLabel(intent.slot, intent.nearLandmarkName);
  }
  const spot = spotName;

  let restaurant: CityRestaurant | null = null;
  if (intent.mode === "named_restaurant" && intent.restaurantName) {
    restaurant = findRestaurantByName(city, intent.restaurantName);
    // Guaranteed city-bound name even if lookup fails (title only)
    if (!restaurant) {
      restaurant = {
        name: intent.restaurantName,
        lat: city.lat,
        lng: city.lng,
        meals: [intent.slot],
        ageTags: [],
        dietary: [],
        budgetStyles: [],
        familyNote: "",
      };
    }
  }

  const label = (() => {
    switch (intent.slot) {
      case "breakfast":
        return breakfastLabel(plan, spot, restaurant);
      case "lunch":
        return lunchLabel(plan, spot, restaurant);
      case "dinner":
        return dinnerLabel(plan, spot, dayIndex, undefined, restaurant);
    }
  })();

  const caveat = dietaryCheckNote(plan, intent.dietaryFit);
  return caveat ? { ...label, notes: `${label.notes} ${caveat}`.trim() } : label;
}

/**
 * When the nearby pick isn't a certain dietary match, say so plainly instead of
 * either hiding it or sending the family across town for a guaranteed one.
 */
export function dietaryCheckNote(
  plan: TripPlan,
  fit: MealIntent["dietaryFit"],
): string {
  if (fit !== "options" && fit !== "unverified" && fit !== "none") return "";
  const needs = parseDietaryTags(plan.dietaryRestrictions);
  if (needs.length === 0) return "";
  const list = needs.join(" / ");
  switch (fit) {
    case "options":
      return `This one is close by and lists ${list} options — check the current menu before you go.`;
    case "unverified":
      return `Closest good family option on today's route, but it isn't a dedicated ${list} spot — check the current menu or call ahead.`;
    default:
      return `No dedicated ${list} spot is close to today's stops — look for ${list} options nearby rather than driving across town.`;
  }
}
