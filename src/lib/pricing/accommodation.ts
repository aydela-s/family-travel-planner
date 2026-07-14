import { CityConfig } from "@/config/city-pricing";
import { getAccommodationLabel } from "@/lib/format-labels";
import { AccommodationType, TripPlan } from "@/types/trip-plan";
import { ItineraryActivity } from "@/types/itinerary";

export type MealPeriod = "breakfast" | "lunch" | "dinner";

export type AccommodationFoodProfile = {
  breakfastMultiplier: number;
  lunchMultiplier: number;
  dinnerMultiplier: number;
  preferGroceryStops: boolean;
  preferCooking: boolean;
  preferRestaurants: boolean;
  planningTips: string[];
};

const PROFILES: Record<AccommodationType, AccommodationFoodProfile> = {
  hotel_breakfast_included: {
    breakfastMultiplier: 0,
    lunchMultiplier: 1,
    dinnerMultiplier: 1,
    preferGroceryStops: false,
    preferCooking: false,
    preferRestaurants: true,
    planningTips: [
      "Use your included hotel breakfast — pack fruit or snacks for later.",
      "Grab simple lunch supplies from the hotel breakfast bar when possible.",
    ],
  },
  hotel_no_breakfast: {
    breakfastMultiplier: 1,
    lunchMultiplier: 1,
    dinnerMultiplier: 1,
    preferGroceryStops: false,
    preferCooking: false,
    preferRestaurants: true,
    planningTips: [
      "Try a neighborhood café for breakfast — quick and kid-friendly.",
      "Supermarket pastries are a budget-smart breakfast backup.",
    ],
  },
  airbnb_with_kitchen: {
    breakfastMultiplier: 0.35,
    lunchMultiplier: 0.55,
    dinnerMultiplier: 0.6,
    preferGroceryStops: true,
    preferCooking: true,
    preferRestaurants: false,
    planningTips: [
      "Stock up at a grocery store and cook breakfast at your Airbnb.",
      "Pack a picnic lunch — easy with a kitchen for prep and storage.",
      "Cook dinner at your stay some nights to balance restaurant spend.",
    ],
  },
  airbnb_no_kitchen: {
    breakfastMultiplier: 0.75,
    lunchMultiplier: 0.9,
    dinnerMultiplier: 0.95,
    preferGroceryStops: true,
    preferCooking: false,
    preferRestaurants: true,
    planningTips: [
      "Grab takeaway breakfasts — no kitchen means cafés and bakeries work best.",
      "Supermarket ready-meals and delis are handy for simple dinners.",
    ],
  },
  staying_with_family_or_friends: {
    breakfastMultiplier: 0.15,
    lunchMultiplier: 0.35,
    dinnerMultiplier: 0.4,
    preferGroceryStops: false,
    preferCooking: false,
    preferRestaurants: false,
    planningTips: [
      "Many meals may be covered by your hosts — budget extra for treats and outings.",
      "Offer to pick up groceries or contribute to shared meals.",
    ],
  },
  "": {
    breakfastMultiplier: 1,
    lunchMultiplier: 1,
    dinnerMultiplier: 1,
    preferGroceryStops: false,
    preferCooking: false,
    preferRestaurants: true,
    planningTips: [],
  },
};

export function getAccommodationProfile(
  accommodationType: AccommodationType | "",
): AccommodationFoodProfile {
  return PROFILES[accommodationType] ?? PROFILES[""];
}

function mealPeriodFromHour(hour: number): MealPeriod {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

export function accommodationMealMultiplier(
  accommodationType: AccommodationType | "",
  hour: number,
  mealTier: number,
): number {
  const profile = getAccommodationProfile(accommodationType);
  const period = mealPeriodFromHour(hour);
  const base =
    period === "breakfast"
      ? profile.breakfastMultiplier
      : period === "lunch"
        ? profile.lunchMultiplier
        : profile.dinnerMultiplier;
  return base * mealTier;
}

export function familyMealUnits(plan: TripPlan): number {
  const childUnits = plan.children.reduce((sum, age) => {
    if (age <= 2) return sum + 0.1;  // toddlers eat from parents' plates
    if (age <= 6) return sum + 0.4;  // kids menu
    if (age <= 12) return sum + 0.6; // kids menu / smaller portion
    return sum + 0.9;                // teen, nearly full meal
  }, 0);
  return plan.adults + childUnits;
}

export function estimateAccommodationFoodCosts(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
  mealTierFn: (activity: ItineraryActivity) => number,
): number {
  const mealUnits = familyMealUnits(plan);
  let total = 0;
  for (const a of activities) {
    if (a.type !== "meal") continue;
    const hour = parseInt(a.time.split(":")[0] ?? "12", 10);
    const base =
      hour < 11 ? city.food.breakfast : hour < 16 ? city.food.lunch : city.food.dinner;
    const tier = mealTierFn(a);
    total += base * accommodationMealMultiplier(plan.accommodationType, hour, tier) * mealUnits;
  }
  return total;
}

export function accommodationPlanningTips(plan: TripPlan): string[] {
  return getAccommodationProfile(plan.accommodationType).planningTips.slice(0, 3);
}

/** @deprecated Use getAccommodationLabel from @/lib/format-labels directly — kept for the one remaining (dead) caller in itinerary.ts */
export function formatAccommodationLabel(type: AccommodationType | ""): string {
  return getAccommodationLabel(type);
}
