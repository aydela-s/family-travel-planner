import { CityConfig } from "@/config/city-pricing";
import { detectCityFromPlan } from "@/lib/city-detect";
import { getTripDayCount, normalizeRawItinerary } from "@/lib/itinerary";
import { fixRawDayActivities } from "@/lib/schedule/fix-itinerary";
import { validateTripDates } from "@/lib/planning-engine/date-validation";
import { applyAdjustAction } from "@/lib/planning-engine/apply-adjustment";
import { AdjustActionId } from "@/lib/planning-engine/adjust-types";
import { getAdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import { buildLandmarkContext, fillDaySkeleton } from "@/lib/planning-engine/slot-filler";
import {
  resolveTransitSelection,
  switchPlanToTaxis,
  transitScheduleIsDifficult,
} from "@/lib/planning-engine/transit-mode";
import {
  applyDailyThemes,
  buildTripStrategy,
  commitStopsToBlueprint,
  buildScheduleFromBlueprint,
  planMealsOnBlueprint,
  resolvePlannerEngine,
  validateAndRepairBlueprint,
} from "@/lib/planning-engine/staged";
import type { PlannerConflict } from "@/lib/planning-engine/conflicts";
import type { PlannerEngine, TripBlueprint } from "@/lib/planning-engine/staged/types";
import { PlanOptions } from "@/lib/planning-engine/types";
import { validatePlannedItinerary } from "@/lib/planning-engine/validators";
import { RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type PlanTripResult = {
  raw: RawItinerary;
  plan: TripPlan;
  /** Shown when we fell back from public transit to taxis. */
  transportNote?: string;
  /** Engine selected for this run (staged may still use score until cutover). */
  plannerEngine: PlannerEngine;
  /** Present when the staged pipeline builds a blueprint (Phase 1+). */
  blueprint?: TripBlueprint;
  /** Hard requirements the planner could not satisfy (blueprint.conflicts). */
  conflicts?: PlannerConflict[];
};

function effectivePlan(plan: TripPlan, options?: PlanOptions): TripPlan {
  if (options?.relaxed) {
    return { ...plan, travelStyle: "relaxed", walkingLimit: "low" };
  }
  return plan;
}

function restaurantNamesFromItinerary(
  itinerary: RawItinerary,
  skipDay?: number,
): Set<string> {
  const names = new Set<string>();
  for (const day of itinerary.days) {
    if (skipDay !== undefined && day.day === skipDay) continue;
    for (const activity of day.activities) {
      if (activity.type !== "meal") continue;
      const match = activity.title.match(/\bat\s+(.+)$/i);
      if (match?.[1]) names.add(match[1].trim());
    }
  }
  return names;
}

function landmarkNamesFromItinerary(
  itinerary: RawItinerary,
  skipDay?: number,
): Set<string> {
  const names = new Set<string>();
  for (const day of itinerary.days) {
    if (skipDay !== undefined && day.day === skipDay) continue;
    for (const activity of day.activities) {
      if (activity.type !== "activity") continue;
      const match = activity.title.match(
        /^(?:Explore|Visit|Family time at|Outdoor time:|Museum & culture:)\s+(.+)$/i,
      );
      if (match?.[1]) names.add(match[1].trim());
      const near = activity.title.match(/\bnear\s+(.+)$/i);
      if (near?.[1]) names.add(near[1].trim());
    }
  }
  return names;
}

function buildDayActivities(
  plan: TripPlan,
  city: CityConfig,
  day: number,
  totalDays: number,
  adjustNote?: string,
  usedRestaurants: Set<string> = new Set(),
  usedLandmarks: Set<string> = new Set(),
): RawItinerary["days"][0]["activities"] {
  const adjustment = getAdjustmentContext(adjustNote, day);
  const slots = buildDaySkeleton(plan, day, totalDays, adjustment);
  const ctx = buildLandmarkContext(city, plan, day, totalDays, adjustNote, usedLandmarks);
  const activities = fillDaySkeleton(
    slots,
    plan,
    city,
    ctx,
    day,
    totalDays,
    adjustNote,
    usedRestaurants,
  );
  return fixRawDayActivities(activities, plan, adjustment, ctx, day);
}

function applySurgicalAdjust(
  plan: TripPlan,
  actionId: AdjustActionId,
  existing: RawItinerary,
  adjustDay: number,
  enrichedDay: NonNullable<PlanOptions["enrichedDay"]>,
): { activities: RawItinerary["days"][0]["activities"]; plan: TripPlan } {
  const dayRaw = existing.days.find((d) => d.day === adjustDay);
  if (!dayRaw) {
    throw new Error(`Day ${adjustDay} not found in existing itinerary`);
  }

  const result = applyAdjustAction(actionId, plan, enrichedDay, dayRaw.activities);
  if (!result.applied) {
    throw new Error(result.message ?? "Could not apply adjustment");
  }

  const adjustedPlan = result.planOverrides ? { ...plan, ...result.planOverrides } : plan;
  const activities = fixRawDayActivities(result.activities, adjustedPlan);
  return { activities, plan: adjustedPlan };
}

/**
 * Deterministic planning engine — builds itinerary structure in code.
 * Default is the staged vacation pipeline (Strategy → Themes → Anchors → Meals →
 * Schedule → Validation). Pass plannerEngine: "score" / PLANNER_ENGINE=score for
 * the quarantined legacy score path.
 */
export function planTrip(plan: TripPlan, options?: PlanOptions): PlanTripResult {
  const dateIssues = validateTripDates(plan);
  if (dateIssues.length > 0) {
    throw new Error(dateIssues.map((i) => i.message).join(" "));
  }

  const plannerEngine = resolvePlannerEngine(options?.plannerEngine);

  let workingPlan = effectivePlan(plan, options);
  const city = options?.cityOverride ?? detectCityFromPlan(workingPlan);
  let transportNote: string | undefined;

  const transitResolved = resolveTransitSelection(workingPlan, city);
  workingPlan = transitResolved.plan;
  if (transitResolved.transportNote) transportNote = transitResolved.transportNote;

  const dayCount = getTripDayCount(workingPlan.startDate, workingPlan.endDate);
  let blueprint = applyDailyThemes(
    buildTripStrategy(workingPlan, {
      city,
      transitMode: workingPlan.transportationType || "public-transportation",
    }),
    workingPlan,
    city,
  );

  if (
    options?.adjustDay &&
    options.existingItinerary &&
    options.adjustAction &&
    options.enrichedDay
  ) {
    const { activities, plan: adjustedPlan } = applySurgicalAdjust(
      workingPlan,
      options.adjustAction,
      options.existingItinerary,
      options.adjustDay,
      options.enrichedDay,
    );
    workingPlan = adjustedPlan;
    return {
      raw: {
        days: options.existingItinerary.days.map((d) =>
          d.day === options.adjustDay ? { day: d.day, activities } : d,
        ),
      },
      plan: workingPlan,
      transportNote,
      plannerEngine,
      blueprint,
    };
  }

  if (options?.adjustDay && options.existingItinerary && options.adjustNote) {
    const usedRestaurants = restaurantNamesFromItinerary(
      options.existingItinerary,
      options.adjustDay,
    );
    const usedLandmarks = landmarkNamesFromItinerary(
      options.existingItinerary,
      options.adjustDay,
    );
    return {
      raw: {
        days: options.existingItinerary.days.map((d) =>
          d.day === options.adjustDay
            ? {
                day: d.day,
                activities: buildDayActivities(
                  workingPlan,
                  city,
                  d.day,
                  dayCount,
                  options.adjustNote,
                  usedRestaurants,
                  usedLandmarks,
                ),
              }
            : d,
        ),
      },
      plan: workingPlan,
      transportNote,
      plannerEngine,
      blueprint,
    };
  }

  /** @deprecated Quarantined legacy path — only when plannerEngine === "score". */
  function buildFullRawScore(p: TripPlan): RawItinerary {
    const usedRestaurants = new Set<string>();
    const usedLandmarks = new Set<string>();
    return {
      days: Array.from({ length: dayCount }, (_, i) => ({
        day: i + 1,
        activities: buildDayActivities(
          p,
          city,
          i + 1,
          dayCount,
          undefined,
          usedRestaurants,
          usedLandmarks,
        ),
      })),
    };
  }

  function buildFullRawStaged(p: TripPlan): { raw: RawItinerary; blueprint: TripBlueprint } {
    const withStops = commitStopsToBlueprint(blueprint, p, city);
    const withMeals = planMealsOnBlueprint(withStops, p, city);
    const { blueprint: repaired } = validateAndRepairBlueprint(withMeals, p, city);
    const days = repaired.days.map((dayBp) => {
      const adjustment = getAdjustmentContext(undefined, dayBp.dayIndex);
      const { activities, ctx } = buildScheduleFromBlueprint(dayBp, p, city);
      return {
        day: dayBp.dayIndex,
        activities: fixRawDayActivities(activities, p, adjustment, ctx, dayBp.dayIndex),
      };
    });
    return { raw: { days }, blueprint: repaired };
  }

  let raw: RawItinerary;
  if (plannerEngine === "score") {
    // Quarantined legacy score engine (rollback / score-only regressions).
    raw = buildFullRawScore(workingPlan);
  } else {
    const staged = buildFullRawStaged(workingPlan);
    raw = staged.raw;
    blueprint = staged.blueprint;
  }

  if (transitScheduleIsDifficult(raw, workingPlan, city)) {
    const fallback = switchPlanToTaxis(workingPlan, city);
    workingPlan = fallback.plan;
    transportNote = fallback.transportNote;
    if (plannerEngine === "score") {
      raw = buildFullRawScore(workingPlan);
    } else {
      // Rebuild themes/strategy under taxi plan, then re-commit stops.
      blueprint = applyDailyThemes(
        buildTripStrategy(workingPlan, {
          city,
          transitMode: workingPlan.transportationType || "taxis",
        }),
        workingPlan,
        city,
      );
      const staged = buildFullRawStaged(workingPlan);
      raw = staged.raw;
      blueprint = staged.blueprint;
    }
  }

  return {
    raw: normalizeRawItinerary(raw, workingPlan),
    plan: workingPlan,
    transportNote,
    plannerEngine,
    blueprint,
    conflicts: blueprint?.conflicts,
  };
}

export {
  resolvePlannerEngine,
  createEmptyBlueprint,
  emptyPlanningRules,
  fingerprintRawItinerary,
  buildTripStrategy,
  buildExperienceCoverageTargets,
  applyDailyThemes,
  commitStopsToBlueprint,
  selectAnchorForDay,
  selectSupportForDay,
  planMealsOnBlueprint,
  buildScheduleFromBlueprint,
  validateBlueprint,
  repairBlueprint,
  validateAndRepairBlueprint,
} from "@/lib/planning-engine/staged";
export type {
  PlannerEngine,
  PlanningRules,
  TripBlueprint,
  ExperienceCoverage,
  DayGoal,
  DayConstraint,
  ThemeId,
  MealIntent,
  ValidationViolation,
} from "@/lib/planning-engine/staged";
export type {
  HardConstraint,
  SoftPreference,
  TripConstraints,
} from "@/lib/planning-engine/constraints";
export { compileTripConstraints } from "@/lib/planning-engine/constraints";
export type {
  PlannerConflict,
  ConflictOption,
} from "@/lib/planning-engine/conflicts";

export function replanDay(
  plan: TripPlan,
  day: number,
  actionId: AdjustActionId,
  existing: RawItinerary,
  enrichedDay: NonNullable<PlanOptions["enrichedDay"]>,
  options?: Omit<PlanOptions, "adjustDay" | "adjustAction" | "existingItinerary" | "enrichedDay">,
): PlanTripResult {
  return planTrip(plan, {
    ...options,
    adjustDay: day,
    adjustAction: actionId,
    existingItinerary: existing,
    enrichedDay,
  });
}

export { validatePlannedItinerary, validateTripDates };
export { getAdjustActionsForDay, isAdjustActionEnabled } from "@/lib/planning-engine/adjust-options";
export type { PlanOptions } from "@/lib/planning-engine/types";
export type { AdjustActionId, AdjustActionOption } from "@/lib/planning-engine/adjust-types";
