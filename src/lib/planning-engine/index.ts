import { detectCity } from "@/lib/city-detect";
import { getTripDayCount, normalizeRawItinerary } from "@/lib/itinerary";
import { fixRawDayActivities } from "@/lib/schedule/fix-itinerary";
import { validateTripDates } from "@/lib/planning-engine/date-validation";
import { applyAdjustAction } from "@/lib/planning-engine/apply-adjustment";
import { AdjustActionId } from "@/lib/planning-engine/adjust-types";
import { getAdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import { buildLandmarkContext, fillDaySkeleton } from "@/lib/planning-engine/slot-filler";
import { PlanOptions } from "@/lib/planning-engine/types";
import { validatePlannedItinerary } from "@/lib/planning-engine/validators";
import { RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type PlanTripResult = {
  raw: RawItinerary;
  plan: TripPlan;
};

function effectivePlan(plan: TripPlan, options?: PlanOptions): TripPlan {
  if (options?.relaxed) {
    return { ...plan, travelStyle: "relaxed", walkingLimit: "low" };
  }
  return plan;
}

function buildDayActivities(
  plan: TripPlan,
  day: number,
  totalDays: number,
  adjustNote?: string,
): RawItinerary["days"][0]["activities"] {
  const city = detectCity(plan.destination);
  const adjustment = getAdjustmentContext(adjustNote, day);
  const slots = buildDaySkeleton(plan, day, totalDays, adjustment);
  const ctx = buildLandmarkContext(city, plan, day, totalDays, adjustNote);
  const activities = fillDaySkeleton(slots, plan, ctx, day, totalDays, adjustNote);
  return fixRawDayActivities(activities, plan, adjustment);
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
 * AI recommendation layer (Phase 7) will fill slot choices later.
 */
export function planTrip(plan: TripPlan, options?: PlanOptions): PlanTripResult {
  const dateIssues = validateTripDates(plan);
  if (dateIssues.length > 0) {
    throw new Error(dateIssues.map((i) => i.message).join(" "));
  }

  let workingPlan = effectivePlan(plan, options);
  const dayCount = getTripDayCount(workingPlan.startDate, workingPlan.endDate);

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
    };
  }

  if (options?.adjustDay && options.existingItinerary && options.adjustNote) {
    return {
      raw: {
        days: options.existingItinerary.days.map((d) =>
          d.day === options.adjustDay
            ? {
                day: d.day,
                activities: buildDayActivities(workingPlan, d.day, dayCount, options.adjustNote),
              }
            : d,
        ),
      },
      plan: workingPlan,
    };
  }

  const raw: RawItinerary = {
    days: Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      activities: buildDayActivities(workingPlan, i + 1, dayCount),
    })),
  };

  return {
    raw: normalizeRawItinerary(raw, workingPlan),
    plan: workingPlan,
  };
}

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
