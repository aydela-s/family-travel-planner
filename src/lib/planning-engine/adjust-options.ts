import {
  ADJUST_ACTION_LABELS,
  AdjustActionId,
  AdjustActionOption,
  DayAdjustContext,
} from "@/lib/planning-engine/adjust-types";
import { buildDayAdjustContext, hasSignificantWalking } from "@/lib/planning-engine/adjust-context";
import { ItineraryDay } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

const ALWAYS: AdjustActionId[] = [
  "fewer_activities",
  "add_activity",
  "more_outdoor_time",
  "replace_main_activity",
  "spend_less_today",
  "spend_more_today",
];

function option(id: AdjustActionId, enabled: boolean, reason?: string): AdjustActionOption {
  return { id, label: ADJUST_ACTION_LABELS[id], enabled, reason };
}

function eligibility(ctx: DayAdjustContext, plan: TripPlan): AdjustActionOption[] {
  const conditional: AdjustActionOption[] = [];

  if (ctx.hasKitchen) {
    conditional.push(
      option(
        "cook_dinner_tonight",
        !ctx.isCookNight,
        ctx.isCookNight ? "Already cooking at your rental tonight" : undefined,
      ),
    );
  }

  conditional.push(
    option(
      "eat_out_tonight",
      ctx.isCookNight || ctx.hasGroceryTonight,
      ctx.isCookNight || ctx.hasGroceryTonight
        ? undefined
        : "Not a cook-at-home night — dinner is already eating out",
    ),
  );

  const significantWalk = hasSignificantWalking(ctx);
  const canLessWalk =
    plan.walkingLimit !== "low" &&
    (plan.transportationType === "walking" || significantWalk || plan.walkingLimit === "high");
  conditional.push(
    option(
      "less_walking",
      canLessWalk,
      plan.walkingLimit === "low"
        ? "Already minimized walking for this trip"
        : !canLessWalk
          ? "This day doesn't have much walking planned"
          : undefined,
    ),
  );

  const alreadyMaxWalk =
    plan.transportationType === "walking" && plan.walkingLimit === "high" && significantWalk;
  conditional.push(
    option(
      "more_walking",
      !alreadyMaxWalk,
      alreadyMaxWalk ? "Already a walking-focused day" : undefined,
    ),
  );

  if (ctx.youngestChild !== null && ctx.youngestChild < 8) {
    conditional.push(option("more_playground_time", true));
  }

  if (ctx.youngestChild !== null && ctx.youngestChild >= 8) {
    conditional.push(
      option(
        "add_evening_activity",
        ctx.eveningGapMin >= 75,
        ctx.eveningGapMin >= 75 ? undefined : "Not enough time before dinner for another stop",
      ),
    );
  }

  return conditional;
}

function alwaysOptions(ctx: DayAdjustContext): AdjustActionOption[] {
  return [
    option(
      "fewer_activities",
      ctx.activityCount > 1,
      ctx.activityCount > 1 ? undefined : "Only one activity left on this day",
    ),
    option(
      "add_activity",
      ctx.eveningGapMin >= 90 || ctx.activityCount <= 1,
      ctx.eveningGapMin >= 90 || ctx.activityCount <= 1
        ? undefined
        : "Day is too full to add another stop",
    ),
    option(
      "more_outdoor_time",
      !ctx.allOutdoorActivities,
      ctx.allOutdoorActivities ? "Activities are already outdoor-focused" : undefined,
    ),
    option(
      "replace_main_activity",
      ctx.hasMorningActivity,
      ctx.hasMorningActivity ? undefined : "No main morning activity to replace",
    ),
    option(
      "spend_less_today",
      ctx.hasPaidActivities || ctx.budgetUsagePercent >= 70,
      ctx.hasPaidActivities || ctx.budgetUsagePercent >= 70
        ? undefined
        : "Already using low-cost options today",
    ),
    option(
      "spend_more_today",
      ctx.budgetUsagePercent < 95,
      ctx.budgetUsagePercent < 95 ? undefined : "Already near your daily budget cap",
    ),
  ];
}

export function getAdjustActionsForDay(plan: TripPlan, day: ItineraryDay): AdjustActionOption[] {
  const ctx = buildDayAdjustContext(plan, day);

  const always = ALWAYS.map((id) => alwaysOptions(ctx).find((o) => o.id === id)!);
  const conditional = eligibility(ctx, plan).filter((o) => {
    if (o.id === "eat_out_tonight")
      return ctx.hasKitchen && (ctx.isCookNight || ctx.hasGroceryTonight);
    if (o.id === "cook_dinner_tonight") return ctx.hasKitchen;
    if (o.id === "more_playground_time") return ctx.youngestChild !== null && ctx.youngestChild < 8;
    if (o.id === "add_evening_activity") return ctx.youngestChild !== null && ctx.youngestChild >= 8;
    if (o.id === "less_walking")
      return (
        plan.transportationType === "walking" ||
        hasSignificantWalking(ctx) ||
        plan.walkingLimit === "high"
      );
    if (o.id === "more_walking")
      return plan.transportationType !== "walking" || plan.walkingLimit !== "high";
    return true;
  });

  return [...always, ...conditional];
}

export function isAdjustActionEnabled(
  plan: TripPlan,
  day: ItineraryDay,
  actionId: AdjustActionId,
): { enabled: boolean; reason?: string } {
  const actions = getAdjustActionsForDay(plan, day);
  const match = actions.find((a) => a.id === actionId);
  return { enabled: match?.enabled ?? false, reason: match?.reason };
}
