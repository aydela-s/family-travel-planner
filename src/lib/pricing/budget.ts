import { CityConfig } from "@/config/city-pricing";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import {
  accommodationPlanningTips,
  estimateAccommodationFoodCosts,
  familyMealUnits,
  getAccommodationProfile,
} from "@/lib/pricing/accommodation";
import { hasCookDinnerAtHome } from "@/lib/schedule/meal-planning";
import { TransportationType, TripPlan } from "@/types/trip-plan";
import { ItineraryActivity } from "@/types/itinerary";
import {
  BUDGET_TARGET_MIN,
  budgetUsagePercent,
  generateCostSavingTips,
  OptimizationFlags,
  reduceSpendingForBudget,
  spendingBalanceNote,
  upgradeSpendingForBudget,
} from "@/lib/pricing/budget-optimizer";

const USD_TO_LOCAL: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  ILS: 3.7,
  JPY: 155,
};

export type EnforcedDayBudget = {
  food: number;
  transport: number;
  activities: number;
  total: number;
  budgetCap: number;
  onBudget: boolean;
  budgetUsagePercentage: number;
  activitiesAdjusted: ItineraryActivity[];
  costSavingTips: string[];
  accommodationTips: string[];
  optimizationFlags: OptimizationFlags;
  effectiveTransport: TransportationType | "";
};

const CATEGORY_CAPS: Record<
  TransportationType | "",
  { food: number; transport: number; activities: number }
> = {
  walking: { food: 0.48, transport: 0.05, activities: 0.47 },
  "car-rental": { food: 0.4, transport: 0.25, activities: 0.35 },
  taxis: { food: 0.36, transport: 0.28, activities: 0.36 },
  "public-transportation": { food: 0.4, transport: 0.15, activities: 0.45 },
  "": { food: 0.42, transport: 0.18, activities: 0.4 },
};

/** Meal cost tiers (fraction of city base) */
const MEAL_TIERS = {
  restaurant: 1,
  takeaway: 0.65,
  picnic: 0.4,
  supermarket: 0.35,
  hotelBreakfast: 0.25,
};

export function convertBudgetToLocal(budgetUsd: number, currency: string): number {
  const rate = USD_TO_LOCAL[currency] ?? 1;
  if (currency === "JPY") return Math.round(budgetUsd * rate);
  return Math.round(budgetUsd * rate * 100) / 100;
}

function roundMoney(amount: number, currency: string): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

function mealTierFromActivity(activity: ItineraryActivity): keyof typeof MEAL_TIERS {
  const t = activity.title.toLowerCase();
  if (t.includes("picnic")) return "picnic";
  if (t.includes("supermarket") || t.includes("ready-meal")) return "supermarket";
  if (t.includes("takeaway") || t.includes("street food") || t.includes("casual")) return "takeaway";
  if (t.includes("hotel breakfast") || t.includes("packed")) return "hotelBreakfast";
  return "restaurant";
}

export function estimateMealCosts(
  activities: ItineraryActivity[],
  city: CityConfig,
  budgetCapLocal: number,
  foodCapFraction?: number,
  plan?: TripPlan,
): number {
  const foodCap = budgetCapLocal * (foodCapFraction ?? 0.5);
  if (plan) {
    return estimateAccommodationFoodCosts(activities, city, plan, foodCap, (a) =>
      MEAL_TIERS[mealTierFromActivity(a)],
    );
  }
  let total = 0;
  for (const a of activities) {
    if (a.type !== "meal") continue;
    const hour = parseInt(a.time.split(":")[0] ?? "12", 10);
    const base =
      hour < 11 ? city.food.breakfast : hour < 16 ? city.food.lunch : city.food.dinner;
    const tier = MEAL_TIERS[mealTierFromActivity(a)];
    total += base * tier;
  }
  return Math.min(total, foodCap);
}

export function pickLandmarkPrice(
  adultPrice: number,
  budgetCapLocal: number,
  transportType: TransportationType | "",
): number {
  const caps = CATEGORY_CAPS[transportType] ?? CATEGORY_CAPS[""];
  const maxSingle = budgetCapLocal * caps.activities * 0.55;
  return Math.min(adultPrice, maxSingle);
}

function sumActivityCosts(activities: ItineraryActivity[]): number {
  return activities.reduce((s, a) => s + (a.activityCost ?? 0), 0);
}

function reconcileBreakdown(
  food: number,
  transport: number,
  activities: ItineraryActivity[],
  budgetCap: number,
  currency: string,
): { food: number; transport: number; activities: number; total: number } {
  const acts = sumActivityCosts(activities);
  const f = roundMoney(food, currency);
  const t = roundMoney(transport, currency);
  const a = roundMoney(acts, currency);
  const total = roundMoney(f + t + a, currency);

  if (total > budgetCap) {
    return clampTotal(f, t, activities, budgetCap, currency);
  }

  return { food: f, transport: t, activities: a, total };
}

function mergeFlags(base: OptimizationFlags, extra: OptimizationFlags): OptimizationFlags {
  return {
    mealsDowngraded: base.mealsDowngraded || extra.mealsDowngraded,
    mealsUpgraded: base.mealsUpgraded || extra.mealsUpgraded,
    groceryStopAdded: base.groceryStopAdded || extra.groceryStopAdded,
    freeActivitiesSwapped: base.freeActivitiesSwapped || extra.freeActivitiesSwapped,
    paidActivitiesAdded: base.paidActivitiesAdded || extra.paidActivitiesAdded,
    transportReduced: base.transportReduced || extra.transportReduced,
    transportUpgraded: base.transportUpgraded || extra.transportUpgraded,
    activitiesScaled: base.activitiesScaled || extra.activitiesScaled,
    optionalExperienceAdded: base.optionalExperienceAdded || extra.optionalExperienceAdded,
  };
}

function clampTotal(
  food: number,
  transport: number,
  activities: ItineraryActivity[],
  budgetCap: number,
  currency: string,
): { food: number; transport: number; activities: number; total: number } {
  let f = food;
  let t = transport;
  let acts = sumActivityCosts(activities);
  let total = f + t + acts;

  if (total <= budgetCap) {
    return {
      food: roundMoney(f, currency),
      transport: roundMoney(t, currency),
      activities: roundMoney(acts, currency),
      total: roundMoney(total, currency),
    };
  }

  const scale = budgetCap / total;
  f = roundMoney(f * scale, currency);
  t = roundMoney(t * scale, currency);
  activities.forEach((a) => {
    if (a.type === "activity" && (a.activityCost ?? 0) > 0) {
      a.activityCost = roundMoney((a.activityCost ?? 0) * scale, currency);
    }
  });
  acts = roundMoney(sumActivityCosts(activities), currency);
  total = roundMoney(f + t + acts, currency);

  if (total > budgetCap) {
    const overflow = total - budgetCap;
    if (t >= overflow) {
      t = roundMoney(t - overflow, currency);
    } else {
      const rem = overflow - t;
      t = 0;
      f = roundMoney(Math.max(0, f - rem), currency);
    }
    acts = roundMoney(sumActivityCosts(activities), currency);
    total = roundMoney(Math.min(f + t + acts, budgetCap), currency);
  }

  return { food: f, transport: t, activities: acts, total };
}

const BUDGET_TARGET_IDEAL = 0.98;

/**
 * Aggressively fill toward ~100% of cap without exceeding it.
 */
function fillBudgetToTarget(
  food: number,
  lockedTransport: number,
  activities: ItineraryActivity[],
  budgetCap: number,
  caps: { food: number; transport: number; activities: number },
  currency: string,
  city: CityConfig,
  plan: TripPlan,
  flags: OptimizationFlags,
): { food: number; transport: number; activities: number; total: number } {
  const target = budgetCap * BUDGET_TARGET_IDEAL;
  const foodMax = budgetCap * caps.food;

  let f = estimateMealCosts(activities, city, budgetCap, caps.food, plan);
  let t = lockedTransport;

  let acts = sumActivityCosts(activities);
  let total = f + t + acts;

  if (total >= target) {
    return { food: f, transport: t, activities: acts, total };
  }

  let activityBudget = Math.max(0, budgetCap - f - t);
  const paid = city.landmarks
    .filter((l) => l.adultPrice > 0)
    .map((l) => ({
      ...l,
      familyCost: familyActivityCost(l.adultPrice, plan.adults, plan.children),
    }))
    .sort((a, b) => b.familyCost - a.familyCost);

  const usedNames = activities
    .filter((a) => a.type === "activity" && a.location)
    .map((a) => a.location!.name.replace(/^Visit /i, ""));

  let paidIdx = 0;
  for (const a of activities) {
    if (a.type !== "activity" || (a.activityCost ?? 0) > 0) continue;
    const pick = paid.slice(paidIdx).find(
      (l) =>
        l.familyCost <= activityBudget &&
        !usedNames.some((n) => l.name.includes(n) || n.includes(l.name)),
    );
    if (!pick) continue;
    paidIdx = paid.indexOf(pick) + 1;
    a.activityCost = pick.familyCost;
    if (!a.title.toLowerCase().includes(pick.name.toLowerCase())) {
      a.title = `Visit ${pick.name}`;
    }
    a.location = { name: pick.name, lat: pick.lat, lng: pick.lng };
    usedNames.push(pick.name);
    activityBudget -= pick.familyCost;
    flags.paidActivitiesAdded = true;
  }

  acts = sumActivityCosts(activities);
  total = f + t + acts;

  while (total < target && activityBudget > budgetCap * 0.05) {
    const pick = paid.find(
      (l) =>
        l.familyCost <= activityBudget &&
        !usedNames.some((n) => l.name.includes(n) || n.includes(l.name)),
    );
    if (!pick) break;

    const dinnerIdx = activities.findIndex(
      (a) => a.type === "meal" && parseInt(a.time.split(":")[0] ?? "18", 10) >= 17,
    );
    const insertAt = dinnerIdx > 0 ? dinnerIdx : activities.length;
    activities.splice(insertAt, 0, {
      time: activities[Math.max(0, insertAt - 1)]?.time ?? "15:30",
      title: `Optional: ${pick.name}`,
      type: "activity",
      timeOfDay: "afternoon",
      notes: "Added to use your daily budget well — skip if kids need downtime.",
      activityCost: pick.familyCost,
      location: { name: pick.name, lat: pick.lat, lng: pick.lng },
    });
    usedNames.push(pick.name);
    activityBudget -= pick.familyCost;
    flags.optionalExperienceAdded = true;
    acts = sumActivityCosts(activities);
    total = f + t + acts;
  }

  // When paid activities can't fill the gap, consider substituting restaurant lunch with a picnic.
  // Only do this when the per-adult budget is too tight to afford both lunch and dinner at a restaurant.
  const mealUnits = familyMealUnits(plan);
  const perAdultBudget = budgetCap / Math.max(1, mealUnits);
  // Only substitute restaurant lunch for a picnic when the per-adult share can't
  // even cover a single restaurant lunch (not just the combined lunch + dinner).
  const budgetTooTightForRestaurantLunch = perAdultBudget < city.food.lunch;

  if (
    total < target &&
    budgetTooTightForRestaurantLunch &&
    !activities.some((a) => a.title.toLowerCase().includes("shopping for picnic"))
  ) {
    const lunchIdx = activities.findIndex(
      (a) =>
        a.type === "meal" &&
        parseInt(a.time.split(":")[0] ?? "12", 10) >= 11 &&
        parseInt(a.time.split(":")[0] ?? "12", 10) < 16 &&
        !a.title.toLowerCase().includes("picnic"),
    );
    if (lunchIdx >= 0) {
      const supplyCost = roundMoney(
        Math.min(city.food.lunch * MEAL_TIERS.picnic * mealUnits, target - total),
        currency,
      );
      if (supplyCost > 0) {
        // Find a free outdoor spot in the city for the picnic meal
        const outdoorSpot = city.landmarks.find((l) => l.adultPrice === 0) ?? null;
        const picnicLocation = outdoorSpot
          ? { name: outdoorSpot.name, lat: outdoorSpot.lat, lng: outdoorSpot.lng }
          : { name: "Local park", lat: city.lat + 0.005, lng: city.lng - 0.003 };

        // Keep existing lunch as a "meal" — just change it to picnic.
          // Use 12:30 so both shopping and picnic sort to the end of the morning
          // queue in rescheduleActivities (after other 9–11 AM activities), and
          // so neither falls inside the nap window (13:00–15:00).
          activities[lunchIdx] = {
            ...activities[lunchIdx],
            title: `Picnic lunch at ${picnicLocation.name}`,
            time: "12:30",
            notes: "A relaxed outdoor lunch together as a family.",
            location: picnicLocation,
          };

          // Insert shopping activity immediately before the picnic meal.
          // Time 12:00 sorts it just before the picnic in the morning queue.
          activities.splice(lunchIdx, 0, {
            time: "12:00",
            title: "Shopping for picnic supplies",
          type: "activity",
          timeOfDay: "morning",
          notes: "Pick up sandwiches, fruit, snacks, and drinks for a family picnic lunch.",
          activityCost: supplyCost,
          location: { name: "Local supermarket", lat: city.lat + 0.009, lng: city.lng - 0.006 },
        });
        flags.groceryStopAdded = true;
        acts = sumActivityCosts(activities);
        total = f + t + acts;
      }
    }
  }

  if (total < target && acts > 0) {
    // Cap to actual remaining headroom (food + transport already fixed), not a
    // fraction cap — a higher-budget day should spend more on activities.
    const desiredActs = Math.min(budgetCap - f - t, acts + (target - total));
    if (desiredActs > acts) {
      const scale = desiredActs / acts;
      activities
        .filter((a) => a.type === "activity" && (a.activityCost ?? 0) > 0)
        .forEach((a) => {
          a.activityCost = roundMoney((a.activityCost ?? 0) * scale, currency);
        });
      acts = sumActivityCosts(activities);
      flags.activitiesScaled = true;
    }
  }

  if (total < target) {
    f = Math.min(foodMax, Math.max(f, estimateMealCosts(activities, city, budgetCap, caps.food, plan)));
  }

  acts = sumActivityCosts(activities);
  total = f + t + acts;

  if (total > budgetCap) {
    const scale = budgetCap / total;
    f = roundMoney(f * scale, currency);
    t = roundMoney(t * scale, currency);
    activities
      .filter((a) => a.type === "activity" && (a.activityCost ?? 0) > 0)
      .forEach((a) => {
        a.activityCost = roundMoney((a.activityCost ?? 0) * scale, currency);
      });
    acts = roundMoney(sumActivityCosts(activities), currency);
    total = roundMoney(Math.min(f + t + acts, budgetCap), currency);
    flags.activitiesScaled = true;
  }

  return {
    food: roundMoney(f, currency),
    transport: roundMoney(t, currency),
    activities: acts,
    total: roundMoney(Math.min(f + t + acts, budgetCap), currency),
  };
}

function resolveDailyTransport(
  lockedDailyTransport: number,
  budgetCapLocal: number,
  caps: { transport: number },
  effectiveTransport: TransportationType | "",
  flags: OptimizationFlags,
  city: CityConfig,
): number {
  if (flags.transportReduced) {
    if (effectiveTransport === "walking") return 0;
    if (effectiveTransport === "public-transportation") {
      return Math.min(city.transport.publicTransitDayPass, budgetCapLocal * caps.transport);
    }
  }
  return Math.min(lockedDailyTransport, budgetCapLocal * caps.transport);
}

function maybeAddAccommodationGroceryStop(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
  flags: OptimizationFlags,
): ItineraryActivity[] {
  const profile = getAccommodationProfile(plan.accommodationType);
  if (!profile.preferGroceryStops) return activities;
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
    location: {
      name: "Neighborhood supermarket",
      lat: city.lat + 0.012,
      lng: city.lng - 0.008,
    },
  };
  flags.groceryStopAdded = true;
  return [...activities.slice(0, insertAt), grocery, ...activities.slice(insertAt)];
}

function fitActivitiesToBudget(
  adjusted: ItineraryActivity[],
  activityBudget: number,
  currency: string,
  flags: OptimizationFlags,
): void {
  // Do not zero individual activities — a single expensive family experience
  // (e.g. family zoo ticket) may legitimately fill most of the activity budget.
  // Proportional scaling below handles the over-budget case correctly.
  const actsTotal = sumActivityCosts(adjusted);
  if (actsTotal > activityBudget && activityBudget > 0) {
    const scale = activityBudget / actsTotal;
    adjusted
      .filter((a) => a.type === "activity")
      .forEach((a) => {
        a.activityCost = roundMoney((a.activityCost ?? 0) * scale, currency);
      });
    flags.activitiesScaled = true;
  } else if (actsTotal > activityBudget) {
    adjusted
      .filter((a) => a.type === "activity")
      .forEach((a) => {
        a.activityCost = 0;
      });
    flags.freeActivitiesSwapped = true;
  }
}

/**
 * Balance family daily spending:
 * - HARD CONSTRAINT: never exceed budgetCap
 * - TARGET: use 80–100% of budget when reasonable options exist
 * - Reduce only when over cap; upgrade when under 70%
 */
export function enforceDailyBudget(
  budgetCapLocal: number,
  currency: string,
  transportType: TransportationType | "",
  activities: ItineraryActivity[],
  _estimatedFood: number,
  lockedDailyTransport: number,
  plan: TripPlan,
  city: CityConfig,
  _preliminaryUsage = 85,
): EnforcedDayBudget {
  let flags: OptimizationFlags = {
    mealsDowngraded: false,
    mealsUpgraded: false,
    groceryStopAdded: false,
    freeActivitiesSwapped: false,
    paidActivitiesAdded: false,
    transportReduced: false,
    transportUpgraded: false,
    activitiesScaled: false,
    optionalExperienceAdded: false,
  };

  let effectiveTransport: TransportationType | "" = transportType;
  let adjusted: ItineraryActivity[] = activities.map((a) => ({
    ...a,
    location: a.location ? { ...a.location } : undefined,
  }));
  adjusted = maybeAddAccommodationGroceryStop(adjusted, plan, city, flags);

  const caps = CATEGORY_CAPS[effectiveTransport] ?? CATEGORY_CAPS[""];

  let food = estimateMealCosts(adjusted, city, budgetCapLocal, caps.food, plan);
  let transport = resolveDailyTransport(
    lockedDailyTransport,
    budgetCapLocal,
    caps,
    effectiveTransport,
    flags,
    city,
  );
  fitActivitiesToBudget(adjusted, Math.max(0, budgetCapLocal - food - transport), currency, flags);

  let reconciled = reconcileBreakdown(food, transport, adjusted, budgetCapLocal, currency);
  food = reconciled.food;
  transport = reconciled.transport;
  let total = reconciled.total;
  let usage = budgetUsagePercent(total, budgetCapLocal);

  if (total > budgetCapLocal) {
    const reduced = reduceSpendingForBudget(adjusted, plan, city);
    adjusted = reduced.activities;
    flags = mergeFlags(flags, reduced.flags);
    effectiveTransport = reduced.suggestedTransport || transportType;

    const reducedCaps = CATEGORY_CAPS[effectiveTransport] ?? CATEGORY_CAPS[""];
    food = estimateMealCosts(adjusted, city, budgetCapLocal, reducedCaps.food, plan);
    transport = resolveDailyTransport(
      lockedDailyTransport,
      budgetCapLocal,
      reducedCaps,
      effectiveTransport,
      flags,
      city,
    );
    fitActivitiesToBudget(adjusted, Math.max(0, budgetCapLocal - food - transport), currency, flags);
    reconciled = reconcileBreakdown(food, transport, adjusted, budgetCapLocal, currency);
    food = reconciled.food;
    transport = reconciled.transport;
    total = reconciled.total;
    usage = budgetUsagePercent(total, budgetCapLocal);
  }

  if (usage < BUDGET_TARGET_MIN) {
    const upgraded = upgradeSpendingForBudget(adjusted, plan, city, budgetCapLocal, total);
    adjusted = upgraded.activities;
    flags = mergeFlags(flags, upgraded.flags);
    if (upgraded.suggestedTransport) effectiveTransport = upgraded.suggestedTransport;

    const upgradedCaps = CATEGORY_CAPS[effectiveTransport] ?? CATEGORY_CAPS[""];
    food = estimateMealCosts(adjusted, city, budgetCapLocal, upgradedCaps.food, plan);
    transport = resolveDailyTransport(
      lockedDailyTransport,
      budgetCapLocal,
      upgradedCaps,
      effectiveTransport,
      flags,
      city,
    );
    fitActivitiesToBudget(adjusted, Math.max(0, budgetCapLocal - food - transport), currency, flags);
    reconciled = reconcileBreakdown(food, transport, adjusted, budgetCapLocal, currency);
    food = reconciled.food;
    transport = reconciled.transport;
    total = reconciled.total;
    usage = budgetUsagePercent(total, budgetCapLocal);
  }

  if (usage < BUDGET_TARGET_IDEAL * 100 && total < budgetCapLocal) {
    const activeCaps = CATEGORY_CAPS[effectiveTransport] ?? CATEGORY_CAPS[""];
    const filled = fillBudgetToTarget(
      food,
      transport,
      adjusted,
      budgetCapLocal,
      activeCaps,
      currency,
      city,
      plan,
      flags,
    );
    reconciled = reconcileBreakdown(
      filled.food,
      transport,
      adjusted,
      budgetCapLocal,
      currency,
    );
    food = reconciled.food;
    transport = reconciled.transport;
    total = reconciled.total;
    usage = budgetUsagePercent(total, budgetCapLocal);
  }

  if (usage < BUDGET_TARGET_IDEAL * 100) {
    const activeCaps = CATEGORY_CAPS[effectiveTransport] ?? CATEGORY_CAPS[""];
    const refilled = fillBudgetToTarget(
      food,
      transport,
      adjusted,
      budgetCapLocal,
      activeCaps,
      currency,
      city,
      plan,
      flags,
    );
    reconciled = reconcileBreakdown(
      refilled.food,
      transport,
      adjusted,
      budgetCapLocal,
      currency,
    );
    food = reconciled.food;
    transport = reconciled.transport;
    total = reconciled.total;
    usage = budgetUsagePercent(total, budgetCapLocal);
  }

  const finalUsage = budgetUsagePercent(total, budgetCapLocal);
  const tips = generateCostSavingTips(finalUsage, flags, plan);
  const accTips = accommodationPlanningTips(plan);

  return {
    food,
    transport,
    activities: reconciled.activities,
    total,
    budgetCap: budgetCapLocal,
    onBudget: total <= budgetCapLocal,
    budgetUsagePercentage: finalUsage,
    activitiesAdjusted: adjusted,
    costSavingTips: tips,
    accommodationTips: accTips,
    optimizationFlags: flags,
    effectiveTransport,
  };
}

export function getBudgetBalanceNote(usagePercent: number): string {
  return spendingBalanceNote(usagePercent);
}

export function getBudgetContext(plan: TripPlan, city: CityConfig) {
  const budgetCapLocal = convertBudgetToLocal(plan.budgetPerDay, city.currency);
  return {
    budgetCapLocal,
    budgetUsd: plan.budgetPerDay,
    isTight: plan.budgetPerDay <= 75,
    isModerate: plan.budgetPerDay <= 150,
    isGenerous: plan.budgetPerDay >= 200,
  };
}

export function estimatePreliminaryUsage(
  city: CityConfig,
  plan: TripPlan,
  budgetCapLocal: number,
): number {
  const mealUnits = plan.adults + plan.children.reduce((sum, age) => {
    if (age <= 2) return sum + 0.1;
    if (age <= 6) return sum + 0.4;
    if (age <= 12) return sum + 0.6;
    return sum + 0.9;
  }, 0);
  const food = (city.food.breakfast + city.food.lunch + city.food.dinner) * mealUnits;
  const transport =
    plan.transportationType === "taxis"
      ? city.transport.baseFare * 4
      : plan.transportationType === "car-rental"
        ? city.transport.fuelPricePerLiter * city.transport.avgFuelLitersPerDay
        : plan.transportationType === "public-transportation"
          ? city.transport.publicTransitDayPass
          : 0;
  const paidLandmarks = city.landmarks.filter((l) => l.adultPrice > 0);
  const activityLandmark = paidLandmarks[0] ?? city.landmarks[0];
  const activities = activityLandmark.adultPrice * plan.adults;
  return budgetUsagePercent(food + transport + activities, budgetCapLocal);
}
