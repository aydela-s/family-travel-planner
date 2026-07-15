import { groceryLocationNearRoute } from "@/lib/planning-engine/meal-timing";
import { CityConfig } from "@/config/city-pricing";
import { accommodationPlanningTips, estimateAccommodationFoodCosts } from "@/lib/pricing/accommodation";
import { budgetStyleNote } from "@/lib/pricing/budget-style";
import { hasCookDinnerAtHome } from "@/lib/schedule/meal-planning";
import { TripPlan } from "@/types/trip-plan";
import { ItineraryActivity } from "@/types/itinerary";

function roundMoney(amount: number, currency: string): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

/** Meal cost tiers (fraction of city base) — set by Budget Style via lunchLabel/dinnerLabel copy, not a dollar target. */
const MEAL_TIERS = {
  premium: 1.4,
  restaurant: 1,
  takeaway: 0.65,
  picnic: 0.4,
  supermarket: 0.35,
  hotelBreakfast: 0.25,
};

function mealTierFromActivity(activity: ItineraryActivity): keyof typeof MEAL_TIERS {
  const t = activity.title.toLowerCase();
  if (t.includes("top pick")) return "premium";
  if (t.includes("picnic")) return "picnic";
  if (t.includes("supermarket") || t.includes("ready-meal")) return "supermarket";
  if (t.includes("casual") || t.includes("takeaway") || t.includes("street food")) return "takeaway";
  if (t.includes("hotel breakfast") || t.includes("packed")) return "hotelBreakfast";
  return "restaurant";
}

export function estimateMealCosts(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
): number {
  return estimateAccommodationFoodCosts(activities, city, plan, (a) => MEAL_TIERS[mealTierFromActivity(a)]);
}

function sumActivityCosts(activities: ItineraryActivity[]): number {
  return activities.reduce((s, a) => s + (a.activityCost ?? 0), 0);
}

/** Insert a grocery stop before a cook-at-home dinner for kitchen accommodations. */
export function maybeAddAccommodationGroceryStop(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
): ItineraryActivity[] {
  if (plan.accommodationType !== "airbnb_with_kitchen") return activities;
  if (activities.some((a) => a.title.toLowerCase().includes("grocery"))) return activities;

  const rawLike = activities.map(({ time, title, type, notes }) => ({ time, title, type, notes }));
  if (!hasCookDinnerAtHome(rawLike)) return activities;

  const returnIdx = activities.findIndex((a) =>
    /\breturn to|back to (your )?(rental|accommodation|stay)\b/i.test(a.title),
  );
  const dinnerIdx = activities.findIndex(
    (a) => a.type === "meal" && /cook dinner|dinner at your rental/i.test(a.title),
  );
  const insertAt =
    returnIdx >= 0 ? returnIdx : dinnerIdx >= 0 ? dinnerIdx : Math.max(activities.length - 1, 0);

  const anchorTime = activities[Math.max(0, insertAt - 1)]?.time ?? "17:00";
  const grocery: ItineraryActivity = {
    time: anchorTime,
    title: "Grocery stop for dinner ingredients",
    type: "activity",
    timeOfDay: "afternoon",
    notes: "Pick up ingredients before heading back to cook dinner.",
    activityCost: 0,
    location: groceryLocationNearRoute(activities, insertAt, city),
  };
  return [...activities.slice(0, insertAt), grocery, ...activities.slice(insertAt)];
}

export type DaySpendSummary = {
  food: number;
  transport: number;
  activities: number;
  total: number;
  note: string;
  accommodationTips: string[];
};

/**
 * Totals up whatever the planning engine already selected for this day — no
 * fitting/optimization passes. Which landmarks and which meal tier get used
 * is already decided style-aware upstream (family-profile.ts,
 * adjust-landmarks.ts, meal-planner.ts); this just adds up the real cost of
 * those choices for the informational cost breakdown.
 */
export function summarizeDailyCost(
  activities: ItineraryActivity[],
  transportCost: number,
  city: CityConfig,
  plan: TripPlan,
): DaySpendSummary {
  const food = roundMoney(estimateMealCosts(activities, city, plan), city.currency);
  const transport = roundMoney(transportCost, city.currency);
  const activitiesCost = roundMoney(sumActivityCosts(activities), city.currency);
  const total = roundMoney(food + transport + activitiesCost, city.currency);

  return {
    food,
    transport,
    activities: activitiesCost,
    total,
    note: budgetStyleNote(plan.budgetStyle),
    accommodationTips: accommodationPlanningTips(plan),
  };
}
