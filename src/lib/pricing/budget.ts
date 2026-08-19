import {
  shouldAddTripStartGrocery,
  shouldPlaceGroceryBeforeRegularNap,
  TRIP_START_GROCERY_TITLE,
  tripStartGroceryNotes,
} from "@/lib/planning-engine/meal-planner";
import { groceryLocationNearRoute } from "@/lib/planning-engine/meal-timing";
import { CityConfig } from "@/config/city-pricing";
import {
  accommodationMealMultiplier,
  accommodationPlanningTips,
  estimateMealPartyCost,
  type MealPartyCost,
} from "@/lib/pricing/accommodation";
import { budgetStyleNote } from "@/lib/pricing/budget-style";
import { BudgetStyle, TripPlan } from "@/types/trip-plan";
import { ActivityLocation, ItineraryActivity } from "@/types/itinerary";

function roundMoney(amount: number, currency: string): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

function sumRounded(amounts: number[], currency: string): number {
  return roundMoney(
    amounts.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0),
    currency,
  );
}

/** Single source of truth: category totals equal the sum of displayed line items. */
export function costsFromDisplayedItems(
  activities: ItineraryActivity[],
  currency: string,
): { food: number; transport: number; activities: number; total: number } {
  const food = sumRounded(
    activities.filter((a) => a.type === "meal").map((a) => a.activityCost ?? 0),
    currency,
  );
  const transport = sumRounded(
    activities.filter((a) => a.type === "travel").map((a) => a.activityCost ?? 0),
    currency,
  );
  const activitiesCost = sumRounded(
    activities
      .filter((a) => a.type === "activity")
      .map((a) => a.activityCost ?? 0),
    currency,
  );
  return {
    food,
    transport,
    activities: activitiesCost,
    total: roundMoney(food + transport + activitiesCost, currency),
  };
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

/** Extra food multiplier so Save / Balanced / Splurge still diverge when meal titles look similar. */
export function budgetStyleFoodFactor(style: BudgetStyle | ""): number {
  switch (style) {
    case "save":
      return 0.8;
    case "splurge":
      return 1.25;
    default:
      return 1;
  }
}

function mealTierFromActivity(activity: ItineraryActivity): keyof typeof MEAL_TIERS {
  const t = `${activity.title} ${activity.notes ?? ""}`.toLowerCase();
  if (t.includes("top pick") || t.includes("standout") || t.includes("special ")) return "premium";
  if (t.includes("picnic") || t.includes("sandwich")) return "picnic";
  if (t.includes("supermarket") || t.includes("ready-meal")) return "supermarket";
  if (
    t.includes("pastries") ||
    t.includes("bakery") ||
    t.includes("takeaway") ||
    t.includes("street food") ||
    t.includes("café or bakery") ||
    t.includes("cafe or bakery") ||
    t.includes("simple bakery")
  ) {
    return "takeaway";
  }
  if (t.includes("hotel breakfast") || t.includes("packed")) return "hotelBreakfast";
  // Named restaurants and "Dinner/Lunch near…" use the sit-down adult price so
  // 1 adult + kids is never billed as bakery takeaway for one person.
  return "restaurant";
}

/** True for nap-window “Delivery lunch at your stay” (and legacy takeout wording). */
export function isDeliveryLunchActivity(
  activity: Pick<ItineraryActivity, "title" | "notes" | "type">,
): boolean {
  if (activity.type !== "meal") return false;
  const t = `${activity.title} ${activity.notes ?? ""}`.toLowerCase();
  return t.includes("delivery") && t.includes("lunch");
}

export type FoodDeliveryFees = {
  fee: number;
  serviceFee: number;
  tipRate: number;
};

/** US-style app defaults when a city omits `food.delivery`. */
export const DEFAULT_FOOD_DELIVERY_FEES: FoodDeliveryFees = {
  fee: 4.99,
  serviceFee: 2.99,
  tipRate: 0.15,
};

/** Resolve delivery fee model for a city (JPY defaults: fees, no tip estimate). */
export function deliveryFeesForCity(city: CityConfig): FoodDeliveryFees {
  const override = city.food.delivery;
  if (override) {
    return {
      fee: override.fee,
      serviceFee: override.serviceFee,
      tipRate: override.tipRate,
    };
  }
  if (city.currency === "JPY") {
    return { fee: 300, serviceFee: 200, tipRate: 0 };
  }
  return DEFAULT_FOOD_DELIVERY_FEES;
}

export type DeliveryLunchCostBreakdown = {
  food: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  total: number;
  party: MealPartyCost;
};

/**
 * Stay delivery lunch = age-aware restaurant food + delivery fee + service fee + tip.
 * Food uses full restaurant lunch (not picnic); kids use childMealShare, not headcount × adult.
 */
export function estimateDeliveryLunchCost(
  activity: ItineraryActivity,
  city: CityConfig,
  plan: TripPlan,
): DeliveryLunchCostBreakdown {
  const round = (amount: number) => roundMoney(amount, city.currency);
  const hour = parseInt(activity.time.split(":")[0] ?? "12", 10);
  const perAdult =
    city.food.lunch *
    accommodationMealMultiplier(plan.accommodationType, hour, MEAL_TIERS.restaurant) *
    budgetStyleFoodFactor(plan.budgetStyle);
  const party = estimateMealPartyCost(perAdult, plan, round);
  const fees = deliveryFeesForCity(city);
  const deliveryFee = round(fees.fee);
  const serviceFee = round(fees.serviceFee);
  const tip = round(party.total * fees.tipRate);
  const total = round(party.total + deliveryFee + serviceFee + tip);
  return {
    food: party.total,
    deliveryFee,
    serviceFee,
    tip,
    total,
    party,
  };
}

/**
 * One meal, priced for the actual party: an adult price for this meal (city
 * base × accommodation × tier × budget style), then adults and children summed
 * separately so kids are never charged at the adult rate.
 */
export function estimateMealPartyCostForActivity(
  activity: ItineraryActivity,
  city: CityConfig,
  plan: TripPlan,
): MealPartyCost {
  if (activity.type !== "meal") {
    return { adults: 0, children: 0, total: 0, detail: "" };
  }

  if (isDeliveryLunchActivity(activity)) {
    const d = estimateDeliveryLunchCost(activity, city, plan);
    const feeBits = [
      `delivery ${Math.round(d.deliveryFee)}`,
      `service ${Math.round(d.serviceFee)}`,
    ];
    if (d.tip > 0) feeBits.push(`tip ${Math.round(d.tip)}`);
    return {
      adults: d.party.adults,
      children: d.party.children,
      total: d.total,
      detail: `${d.party.detail} + ${feeBits.join(" + ")}`,
    };
  }

  const hour = parseInt(activity.time.split(":")[0] ?? "12", 10);
  const base =
    hour < 11 ? city.food.breakfast : hour < 16 ? city.food.lunch : city.food.dinner;
  const tier = MEAL_TIERS[mealTierFromActivity(activity)];
  const perAdult =
    base *
    accommodationMealMultiplier(plan.accommodationType, hour, tier) *
    budgetStyleFoodFactor(plan.budgetStyle);
  return estimateMealPartyCost(perAdult, plan, (amount) =>
    roundMoney(amount, city.currency),
  );
}

/** Single meal’s estimated family cost (same model as the day food total). */
export function estimateMealCostForActivity(
  activity: ItineraryActivity,
  city: CityConfig,
  plan: TripPlan,
): number {
  return estimateMealPartyCostForActivity(activity, city, plan).total;
}

/** Attach per-meal costs plus the adult/child split onto meal rows. */
export function applyMealActivityCosts(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
): ItineraryActivity[] {
  return activities.map((a) => {
    if (a.type !== "meal") return a;
    const party = estimateMealPartyCostForActivity(a, city, plan);
    const breakdown =
      party.total > 0 && party.detail
        ? `Est. ${city.currencySymbol}${Math.round(party.total)} for ${party.detail}`
        : "";
    return {
      ...a,
      activityCost: party.total,
      notes: breakdown ? [a.notes, breakdown].filter(Boolean).join(" ") : a.notes,
    };
  });
}

export function estimateMealCosts(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
): number {
  return activities
    .filter((a) => a.type === "meal")
    .reduce((sum, a) => sum + estimateMealCostForActivity(a, city, plan), 0);
}

/** Insert the one trip-start grocery run for kitchen accommodations (FAM-75). */
export function maybeAddAccommodationGroceryStop(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
  home?: ActivityLocation | null,
  day: number = 1,
): ItineraryActivity[] {
  if (!shouldAddTripStartGrocery(plan, day)) return activities;
  if (activities.some((a) => a.title.toLowerCase().includes("grocery"))) return activities;

  const napIdx = shouldPlaceGroceryBeforeRegularNap(plan, day)
    ? activities.findIndex((a) => a.type === "nap")
    : -1;
  const dinnerIdx = activities.findIndex(
    (a) => a.type === "meal" && /cook dinner|dinner at your rental|\bdinner\b/i.test(a.title),
  );
  const insertAt =
    napIdx >= 0 ? napIdx : dinnerIdx >= 0 ? dinnerIdx : Math.max(activities.length - 1, 0);
  const anchorTime = activities[Math.max(0, insertAt - 1)]?.time ?? "17:00";
  const grocery: ItineraryActivity = {
    time: anchorTime,
    title: TRIP_START_GROCERY_TITLE,
    type: "activity",
    timeOfDay: "afternoon",
    notes: tripStartGroceryNotes(plan, day),
    activityCost: 0,
    location: groceryLocationNearRoute(activities, insertAt, city, home),
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
  day: number = 1,
): DaySpendSummary {
  const line = costsFromDisplayedItems(activities, city.currency);
  const hasTravelRows = activities.some((a) => a.type === "travel");
  const food = line.food;
  const transport = hasTravelRows
    ? line.transport
    : roundMoney(transportCost, city.currency);
  const activitiesCost = line.activities;
  const total = roundMoney(food + transport + activitiesCost, city.currency);

  const landmarkNames = activities
    .filter((a) => a.type === "activity" && a.location?.name)
    .map((a) => a.location!.name);

  return {
    food,
    transport,
    activities: activitiesCost,
    total,
    note: budgetStyleNote(plan.budgetStyle),
    accommodationTips: accommodationPlanningTips(plan, day, {
      landmarkNames,
      cookingDinner: activities.some((a) =>
        /\bcook dinner|dinner at your (rental|stay|airbnb)\b/i.test(a.title),
      ),
    }),
  };
}
