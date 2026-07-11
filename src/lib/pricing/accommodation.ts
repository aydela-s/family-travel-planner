import { CityConfig } from "@/config/city-pricing";
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

export function estimateAccommodationFoodCosts(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
  foodCap: number,
  mealTierFn: (activity: ItineraryActivity) => number,
): number {
  let total = 0;
  for (const a of activities) {
    if (a.type !== "meal") continue;
    const hour = parseInt(a.time.split(":")[0] ?? "12", 10);
    const base =
      hour < 11 ? city.food.breakfast : hour < 16 ? city.food.lunch : city.food.dinner;
    const tier = mealTierFn(a);
    total += base * accommodationMealMultiplier(plan.accommodationType, hour, tier);
  }
  return Math.min(total, foodCap);
}

export function accommodationPlanningTips(plan: TripPlan): string[] {
  return getAccommodationProfile(plan.accommodationType).planningTips.slice(0, 3);
}

export function formatAccommodationLabel(type: AccommodationType | ""): string {
  const labels: Record<AccommodationType, string> = {
    hotel_breakfast_included: "Hotel (breakfast included)",
    hotel_no_breakfast: "Hotel (no breakfast)",
    airbnb_with_kitchen: "Airbnb / rental with kitchen",
    airbnb_no_kitchen: "Airbnb / rental (no kitchen)",
    staying_with_family_or_friends: "Staying with family or friends",
    "": "Not specified",
  };
  return labels[type] ?? "Not specified";
}
