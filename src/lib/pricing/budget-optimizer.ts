import { getTimeOfDay } from "@/lib/format";
import { CityConfig } from "@/config/city-pricing";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import { TransportationType, TripPlan } from "@/types/trip-plan";
import { ItineraryActivity } from "@/types/itinerary";

export type OptimizationFlags = {
  mealsDowngraded: boolean;
  mealsUpgraded: boolean;
  groceryStopAdded: boolean;
  freeActivitiesSwapped: boolean;
  paidActivitiesAdded: boolean;
  transportReduced: boolean;
  transportUpgraded: boolean;
  activitiesScaled: boolean;
  optionalExperienceAdded: boolean;
};

export type BudgetOptimizeResult = {
  activities: ItineraryActivity[];
  flags: OptimizationFlags;
  suggestedTransport: TransportationType | "";
};

export const BUDGET_TARGET_MIN = 70;
export const BUDGET_TARGET_LOW = 80;
export const BUDGET_TARGET_HIGH = 100;
export const BUDGET_TIP_THRESHOLD = 80;

export function budgetUsagePercent(total: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(100, Math.round((total / cap) * 1000) / 10);
}

export function shouldShowSavingTips(usagePercent: number, flags: OptimizationFlags): boolean {
  return (
    usagePercent >= BUDGET_TIP_THRESHOLD &&
    (flags.mealsDowngraded ||
      flags.freeActivitiesSwapped ||
      flags.transportReduced ||
      flags.groceryStopAdded)
  );
}

function emptyFlags(): OptimizationFlags {
  return {
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
}

function cloneActivities(activities: ItineraryActivity[]): ItineraryActivity[] {
  return activities.map((a) => ({
    ...a,
    timeOfDay: a.timeOfDay ?? getTimeOfDay(a.time),
    location: a.location ? { ...a.location } : undefined,
  }));
}

function mealHour(activity: ItineraryActivity): number {
  return parseInt(activity.time.split(":")[0] ?? "12", 10);
}

function isFreeActivity(a: ItineraryActivity): boolean {
  return a.type === "activity" && (a.activityCost ?? 0) === 0;
}

function pickPaidLandmark(
  city: CityConfig,
  plan: TripPlan,
  index: number,
  maxFamilyCost: number,
  excludeNames: string[] = [],
): { name: string; lat: number; lng: number; familyCost: number; adultPrice: number } | null {
  const paid = city.landmarks
    .filter((l) => l.adultPrice > 0 && !excludeNames.includes(l.name))
    .map((l) => ({
      ...l,
      familyCost: familyActivityCost(l.adultPrice, plan.adults, plan.children),
    }))
    .filter((l) => l.familyCost <= maxFamilyCost)
    .sort((a, b) => b.familyCost - a.familyCost);

  if (paid.length === 0) return null;
  const pick = paid[index % paid.length];
  return {
    name: pick.name,
    lat: pick.lat,
    lng: pick.lng,
    familyCost: pick.familyCost,
    adultPrice: pick.adultPrice,
  };
}

/** Reduce spend only when the day would exceed the hard cap */
export function reduceSpendingForBudget(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
): BudgetOptimizeResult {
  const flags = emptyFlags();
  let result = cloneActivities(activities);
  let suggestedTransport: TransportationType | "" = plan.transportationType;

  const veryTight = plan.budgetPerDay <= 75;

  if (plan.transportationType === "taxis") {
    suggestedTransport = plan.walkingLimit === "low" ? "public-transportation" : "walking";
    flags.transportReduced = true;
  }

  result = result.map((a) => {
    if (a.type !== "meal") return a;
    const hour = mealHour(a);
    flags.mealsDowngraded = true;
    if (hour < 11) {
      return {
        ...a,
        title: "Hotel breakfast + packed snacks",
        notes: "Use breakfast included or grab simple items to save for later.",
      };
    }
    if (hour < 15) {
      return {
        ...a,
        title: "Picnic lunch in the park",
        notes: "Pack sandwiches or pick up groceries — kid-friendly and budget-smart.",
      };
    }
    if (hour >= 17) {
      return {
        ...a,
        title: veryTight ? "Supermarket ready-meal dinner" : "Casual takeaway dinner",
        notes: veryTight
          ? "Ready meals or deli counter — saves vs. sit-down restaurant."
          : "Street food or takeaway instead of a sit-down restaurant.",
      };
    }
    return a;
  });

  result = result.map((a) => {
    if (a.type !== "activity") return a;
    if ((a.activityCost ?? 0) > 0) {
      flags.freeActivitiesSwapped = true;
      const free = city.landmarks.find((l) => l.adultPrice === 0) ?? city.landmarks[0];
      return {
        ...a,
        title: `Free family time at ${free.name}`,
        activityCost: 0,
        notes: [a.notes, "Free alternative to stay within your daily family budget."]
          .filter(Boolean)
          .join(" "),
        location: a.location ?? { name: free.name, lat: free.lat, lng: free.lng },
      };
    }
    return a;
  });

  const canWalk =
    plan.transportationType === "walking" ||
    suggestedTransport === "walking" ||
    plan.walkingLimit !== "low";

  if (canWalk && !result.some((a) => a.title.toLowerCase().includes("grocery"))) {
    const parkIdx = result.findIndex(
      (a) =>
        a.type === "rest" ||
        a.type === "activity" ||
        a.title.toLowerCase().includes("park") ||
        a.title.toLowerCase().includes("picnic"),
    );
    const insertAt = parkIdx > 0 ? parkIdx : result.findIndex((a) => a.type === "meal") + 1;

    if (insertAt > 0) {
      const grocery: ItineraryActivity = {
        time: result[Math.max(0, insertAt - 1)]?.time ?? "09:30",
        title: "Grocery stop for picnic supplies",
        type: "activity",
        timeOfDay: "morning",
        notes: "Short walk to a supermarket — snacks, fruit, and drinks for the family.",
        activityCost: 0,
        location: {
          name: "Neighborhood supermarket",
          lat: city.lat + 0.012,
          lng: city.lng - 0.008,
        },
      };
      result = [...result.slice(0, insertAt), grocery, ...result.slice(insertAt)];
      flags.groceryStopAdded = true;
    }
  }

  return { activities: result, flags, suggestedTransport };
}

/** Upgrade experiences when the day significantly under-uses the budget */
export function upgradeSpendingForBudget(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
  budgetCapLocal: number,
  currentTotal: number,
): BudgetOptimizeResult {
  const flags = emptyFlags();
  let result = cloneActivities(activities);
  const suggestedTransport: TransportationType | "" = plan.transportationType;
  let headroom = budgetCapLocal - currentTotal;

  result = result.map((a) => {
    if (a.type !== "meal") return a;
    const hour = mealHour(a);
    const t = a.title.toLowerCase();
    if (t.includes("picnic") || t.includes("supermarket") || t.includes("takeaway") || t.includes("packed")) {
      flags.mealsUpgraded = true;
      if (hour < 11) {
        return { ...a, title: "Sit-down family breakfast", notes: "Café or hotel restaurant — relaxed start to the day." };
      }
      if (hour < 16) {
        return { ...a, title: "Family lunch at a local restaurant", notes: "Kid-friendly menu with local flavors." };
      }
      return { ...a, title: "Family dinner at a neighborhood restaurant", notes: "Sit-down meal — a highlight of the day." };
    }
    return a;
  });

  let paidIdx = 0;
  const usedNames: string[] = [];
  result = result.map((a) => {
    if (!isFreeActivity(a)) return a;
    const maxCost = Math.max(headroom * 0.85, budgetCapLocal * 0.4);
    const landmark = pickPaidLandmark(city, plan, paidIdx++, maxCost, usedNames);
    if (!landmark) return a;
    flags.paidActivitiesAdded = true;
    usedNames.push(landmark.name);
    headroom -= landmark.familyCost;
    return {
      ...a,
      title: a.title.toLowerCase().includes("visit") ? a.title : `Visit ${landmark.name}`,
      activityCost: landmark.familyCost,
      notes: [a.notes, "Worthwhile paid experience within your daily family budget."]
        .filter(Boolean)
        .join(" "),
      location: { name: landmark.name, lat: landmark.lat, lng: landmark.lng },
    };
  });

  while (headroom > budgetCapLocal * 0.08) {
    const maxCost = headroom * 0.9;
    const extra = pickPaidLandmark(city, plan, paidIdx++, maxCost, usedNames);
    if (!extra) break;

    const dinnerIdx = result.findIndex((a) => a.type === "meal" && mealHour(a) >= 17);
    const insertAt = dinnerIdx > 0 ? dinnerIdx : result.length - 1;
      const optional: ItineraryActivity = {
        time: result[Math.max(0, insertAt - 1)]?.time ?? "15:30",
        title: `Optional: ${extra.name}`,
        type: "activity",
        timeOfDay: "afternoon",
        notes: "Added to make the most of your daily budget — skip if the kids need downtime.",
      activityCost: extra.familyCost,
      location: { name: extra.name, lat: extra.lat, lng: extra.lng },
    };
    result = [...result.slice(0, insertAt), optional, ...result.slice(insertAt)];
    flags.optionalExperienceAdded = true;
    usedNames.push(extra.name);
    headroom -= extra.familyCost;
    paidIdx += 1;
  }

  if (
    plan.transportationType === "taxis" &&
    plan.walkingLimit === "low" &&
    headroom > city.transport.baseFare * 2
  ) {
    flags.transportUpgraded = true;
  }

  return { activities: result, flags, suggestedTransport };
}

/** @deprecated Use reduceSpendingForBudget — kept for import compatibility during refactor */
export function optimizeActivitiesForBudget(
  activities: ItineraryActivity[],
  plan: TripPlan,
  city: CityConfig,
  _budgetCapLocal: number,
  preliminaryUsage = 100,
): BudgetOptimizeResult {
  if (preliminaryUsage > BUDGET_TARGET_HIGH) {
    return reduceSpendingForBudget(activities, plan, city);
  }
  return { activities: cloneActivities(activities), flags: emptyFlags(), suggestedTransport: plan.transportationType };
}

export function generateCostSavingTips(
  usagePercent: number,
  flags: OptimizationFlags,
  plan: TripPlan,
): string[] {
  if (!shouldShowSavingTips(usagePercent, flags)) return [];

  const tips: string[] = [];
  const hasYoungKids = plan.children.some((age) => age <= 7);

  if (flags.mealsDowngraded) {
    tips.push("Pack sandwiches for lunch to save money");
    if (hasYoungKids) {
      tips.push("Buy groceries near your stay instead of dining out for every meal");
    }
    tips.push("Have a picnic in the park instead of a restaurant lunch");
  }

  if (flags.groceryStopAdded) {
    tips.push("Stock up at the grocery stop for snacks — avoids impulse café spending");
  }

  if (flags.freeActivitiesSwapped) {
    tips.push("Free parks and playgrounds keep kids happy without ticket costs");
  }

  if (flags.transportReduced) {
    tips.push("Walk or use public transit instead of taxis to protect your daily budget");
  }

  return [...new Set(tips)].slice(0, 4);
}

export function spendingBalanceNote(usagePercent: number): string {
  if (usagePercent > BUDGET_TARGET_HIGH) {
    return "Costs trimmed to stay within your daily family cap.";
  }
  if (usagePercent >= BUDGET_TARGET_LOW) {
    return "Balanced spending — your day uses the budget efficiently for an enjoyable family experience.";
  }
  if (usagePercent >= BUDGET_TARGET_MIN) {
    return "Moderate spending — a comfortable day with room left in your daily budget.";
  }
  return "Light spending day — fewer paid options fit naturally within your budget for this destination.";
}
