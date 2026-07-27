import type { CityConfig } from "@/config/city-pricing";
import { getTripDayCount } from "@/lib/itinerary";
import { emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
import { buildExperienceCoverageTargets } from "@/lib/planning-engine/staged/experience-coverage";
import {
  LOW_FRICTION_PREFERRED_KM,
  LOW_FRICTION_STAY_KM,
} from "@/lib/planning-engine/staged/landmark-experience";
import {
  TRIP_BLUEPRINT_VERSION,
  type DayBlueprint,
  type DayConstraint,
  type DayGoal,
  type DayRole,
  type PlanningRules,
  type TripBlueprint,
} from "@/lib/planning-engine/staged/types";
import type { TransportationType, TripPlan } from "@/types/trip-plan";

function addDaysIso(startDate: string, offset: number): string {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function tripDates(plan: TripPlan, dayCount: number): string[] {
  return Array.from({ length: dayCount }, (_, i) => addDaysIso(plan.startDate, i));
}

/**
 * Arrival / full / departure roles.
 * 1-day trip = arrival+departure combined as "arrival" with tighter constraints.
 * 2-day = arrival + departure.
 * 3+ = arrival, full…, departure.
 */
export function assignDayRoles(dayCount: number): DayRole[] {
  if (dayCount <= 0) return [];
  if (dayCount === 1) return ["arrival"];
  if (dayCount === 2) return ["arrival", "departure"];
  return [
    "arrival",
    ...Array.from({ length: dayCount - 2 }, () => "full" as const),
    "departure",
  ];
}

/**
 * Arrival/departure stay-proximity band (~20–30 min drive).
 * Convenience level nudges the soft preferred band, not the hard outer ring.
 */
function stayNearKm(rules: PlanningRules): number {
  switch (rules.convenienceLevel) {
    case "high":
      return LOW_FRICTION_STAY_KM;
    case "low":
      return LOW_FRICTION_PREFERRED_KM;
    default:
      return Math.round((LOW_FRICTION_PREFERRED_KM + LOW_FRICTION_STAY_KM) / 2);
  }
}

/** Baseline goals/constraints from day role — Theme Generator adds experience goals later. */
export function goalsAndConstraintsForRole(
  role: DayRole,
  rules: PlanningRules,
): { goals: DayGoal[]; constraints: DayConstraint[]; dayBudgetIntent: DayBlueprint["dayBudgetIntent"] } {
  const near = stayNearKm(rules);

  if (role === "arrival") {
    return {
      goals: [
        { type: "low_friction" },
        { type: "keep_energy_low" },
        { type: "prefer_near_stay_or_flexible_outdoor", maxKm: near },
        ...(rules.napWindows.length > 0 ? [{ type: "honor_nap_windows" as const }] : []),
      ],
      constraints: [
        { type: "avoid_far_attractions", maxKm: LOW_FRICTION_STAY_KM },
        { type: "avoid_high_risk_time_sensitive_anchor" },
        { type: "avoid_fixed_time_experiences" },
        { type: "avoid_paid_tickets" },
        { type: "prefer_free_anchor" },
        { type: "prefer_low_walking" },
        { type: "max_activities", n: Math.min(2, rules.capacity.maxActivitiesPerDay) },
        {
          type: "discourage_anchor_tags",
          tags: ["theme-parks", "museums", "interactive", "zoos"],
        },
      ],
      dayBudgetIntent: rules.budgetStyle === "splurge" ? "either" : "free",
    };
  }

  if (role === "departure") {
    return {
      goals: [
        { type: "easy_exit" },
        { type: "keep_energy_low" },
        { type: "prefer_near_stay_or_flexible_outdoor", maxKm: near },
      ],
      constraints: [
        { type: "avoid_far_attractions", maxKm: LOW_FRICTION_STAY_KM },
        { type: "avoid_fixed_time_experiences" },
        { type: "avoid_paid_tickets" },
        { type: "prefer_free_anchor" },
        { type: "prefer_low_walking" },
        { type: "avoid_high_risk_time_sensitive_anchor" },
        { type: "max_activities", n: Math.min(1, rules.capacity.maxActivitiesPerDay) },
        {
          type: "discourage_anchor_tags",
          tags: ["theme-parks", "museums", "interactive", "zoos"],
        },
      ],
      dayBudgetIntent: "free",
    };
  }

  if (role === "recovery") {
    return {
      goals: [
        { type: "keep_energy_low" },
        { type: "prefer_outdoor" },
        ...(rules.napWindows.length > 0 ? [{ type: "honor_nap_windows" as const }] : []),
      ],
      constraints: [
        { type: "max_activities", n: 1 },
        { type: "prefer_recovery_outdoor" },
        { type: "prefer_free_anchor" },
        { type: "discourage_anchor_tags", tags: ["theme-parks"] },
      ],
      dayBudgetIntent: "free",
    };
  }

  return {
    goals: [
      ...(rules.napWindows.length > 0 ? [{ type: "honor_nap_windows" as const }] : []),
    ],
    constraints: [],
    dayBudgetIntent: "either",
  };
}

function capacityForRole(
  role: DayRole,
  rules: PlanningRules,
): PlanningRules["capacity"] {
  const base = rules.capacity;
  if (role === "arrival") {
    return {
      ...base,
      maxActivitiesPerDay: Math.min(base.maxActivitiesPerDay, 2),
      maxSupportStops: Math.min(base.maxSupportStops, 1),
    };
  }
  if (role === "departure" || role === "recovery") {
    return {
      ...base,
      maxActivitiesPerDay: 1,
      maxSupportStops: 0,
      preferHalfDayAnchor: true,
    };
  }
  return { ...base };
}

export type BuildTripStrategyOptions = {
  city: CityConfig;
  transitMode?: TransportationType;
};

/**
 * Trip Strategy Builder — compiles Budget/Pace into PlanningRules, seeds
 * ExperienceCoverage targets, and creates day shells with roles + baseline
 * goals/constraints. Theme assignment is a separate stage.
 */
export function buildTripStrategy(
  plan: TripPlan,
  options: BuildTripStrategyOptions,
): TripBlueprint {
  const dayCount = getTripDayCount(plan.startDate, plan.endDate);
  const dates = tripDates(plan, dayCount);
  const rules = emptyPlanningRules(plan);
  const transitMode =
    options.transitMode || plan.transportationType || "public-transportation";
  const roles = assignDayRoles(dayCount);
  const experienceCoverage = buildExperienceCoverageTargets(plan, dayCount);

  const days: DayBlueprint[] = dates.map((date, i) => {
    const role = roles[i] ?? "full";
    const { goals, constraints, dayBudgetIntent } = goalsAndConstraintsForRole(role, rules);
    return {
      dayIndex: i + 1,
      date,
      role,
      theme: {
        id: "mixed_family",
        label: "Pending theme",
        primaryTags: [],
        secondaryTags: [],
        preferredExperienceTypes: [],
      },
      goals,
      constraints,
      dayBudgetIntent,
      capacity: capacityForRole(role, rules),
      support: [],
      meals: [],
    };
  });

  return {
    blueprintVersion: TRIP_BLUEPRINT_VERSION,
    strategy: {
      budgetStyle: rules.budgetStyle,
      pace: rules.pace,
      transitMode,
      destination: plan.destination,
      dayCount,
    },
    rules,
    interestQuota: experienceCoverage.items.map((i) => ({
      tag: i.tag,
      target: i.target,
      scheduled: i.completed,
    })),
    experienceCoverage,
    days,
    ledger: {
      landmarkNames: [],
      restaurantNames: [],
      satisfiedInterestTags: [],
    },
  };
}
