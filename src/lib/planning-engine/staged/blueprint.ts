import type { BudgetStyle, TravelStyle, TransportationType, TripPlan } from "@/types/trip-plan";
import {
  TRIP_BLUEPRINT_VERSION,
  type PlanningRules,
  type TripBlueprint,
} from "@/lib/planning-engine/staged/types";
import { getIntensityConfig } from "@/lib/schedule/travel-style";

/** Placeholder rules — Strategy Builder uses this as the Budget/Pace compiler seed. */
export function emptyPlanningRules(plan: TripPlan): PlanningRules {
  const budgetStyle: BudgetStyle = plan.budgetStyle || "balanced";
  const pace: TravelStyle = plan.travelStyle || "balanced";
  const transportPreference: TransportationType =
    plan.transportationType || "public-transportation";
  const intensity = getIntensityConfig(plan);

  return {
    budgetStyle,
    pace,
    paidDayRatio: budgetStyle === "save" ? 0.2 : budgetStyle === "splurge" ? 0.8 : 0.45,
    maxPaidAnchorsPerDay: 1,
    premiumExperienceTarget: budgetStyle === "save" ? 1 : budgetStyle === "splurge" ? 4 : 2,
    namedRestaurantMeals:
      budgetStyle === "splurge"
        ? ["breakfast", "lunch", "dinner"]
        : budgetStyle === "save"
          ? ["dinner"]
          : ["dinner"],
    lunchFormality: budgetStyle === "splurge" ? "named_casual" : "picnic_or_casual",
    dinnerFormality: budgetStyle === "save" ? "named_casual" : "named_sit_down",
    preferCookNights: budgetStyle !== "splurge",
    preferPicnicLunch: budgetStyle !== "splurge",
    transportPreference,
    convenienceLevel: budgetStyle === "splurge" ? "high" : budgetStyle === "save" ? "low" : "medium",
    capacity: {
      maxActivitiesPerDay: intensity.maxActivities,
      maxSupportStops:
        intensity.maxActivities <= 1 ? 0 : pace === "packed" ? 2 : 1,
      preferHalfDayAnchor: pace !== "relaxed",
      includeMiddayRest: pace !== "packed",
      activityDurationMin: intensity.activityDurationMin,
      restDurationMin: intensity.restDurationMin,
    },
    napWindows: plan.naps ?? [],
  };
}

/** @deprecated Prefer buildTripStrategy — kept for thin shells in tests. */
export function createEmptyBlueprint(
  plan: TripPlan,
  opts: { dayCount: number; transitMode: TransportationType; dates: string[] },
): TripBlueprint {
  const rules = emptyPlanningRules(plan);
  return {
    blueprintVersion: TRIP_BLUEPRINT_VERSION,
    strategy: {
      budgetStyle: rules.budgetStyle,
      pace: rules.pace,
      transitMode: opts.transitMode,
      destination: plan.destination,
      dayCount: opts.dayCount,
    },
    rules,
    interestQuota: [],
    experienceCoverage: { items: [] },
    days: opts.dates.map((date, i) => ({
      dayIndex: i + 1,
      date,
      role: "full" as const,
      theme: {
        id: "mixed_family",
        label: "Unset",
        primaryTags: [],
        secondaryTags: [],
        preferredExperienceTypes: [],
      },
      goals: [],
      constraints: [],
      dayBudgetIntent: "either",
      capacity: rules.capacity,
      support: [],
      meals: [],
    })),
    ledger: {
      landmarkNames: [],
      restaurantNames: [],
      satisfiedInterestTags: [],
    },
  };
}
