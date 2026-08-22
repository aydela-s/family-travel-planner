import type { CityConfig } from "@/config/city-pricing";
import { compileTripConstraints } from "@/lib/planning-engine/constraints";
import type { PlannerConflict } from "@/lib/planning-engine/conflicts";
import { getAdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import {
  selectAnchorForDay,
  toCommittedStop,
} from "@/lib/planning-engine/staged/anchor-selector";
import {
  coverageThroughPriorDays,
} from "@/lib/planning-engine/staged/fill-stops";
import { planMealsForDay } from "@/lib/planning-engine/staged/meal-planner";
import { buildScheduleFromBlueprint } from "@/lib/planning-engine/staged/schedule-builder";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import type { DayBlueprint, TripBlueprint } from "@/lib/planning-engine/staged/types";
import {
  anchorVisitWindow,
  supportVisitWindow,
} from "@/lib/planning-engine/staged/visit-windows";
import { uncoveredSelectedTags } from "@/lib/planning-engine/staged/experience-coverage";
import { fixRawDayActivities } from "@/lib/schedule/fix-itinerary";
import type { RawActivity } from "@/lib/planning-engine/types";
import type { TripPlan } from "@/types/trip-plan";

function priorFullDayAnchors(blueprint: TripBlueprint, beforeDay: number): Set<string> {
  const names = new Set<string>();
  for (const day of blueprint.days) {
    if (day.dayIndex >= beforeDay) break;
    if (day.role === "full" && day.anchor) names.add(day.anchor.landmarkName);
  }
  return names;
}

/**
 * Rebuild one blueprint day under staged hard rules while honoring trip ledger
 * from all other days (adjust-note replan on the default engine).
 */
export function replanStagedDayWithNote(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
  adjustDay: number,
  adjustNote: string,
  ledgerLandmarks: Set<string>,
  ledgerRestaurants: Set<string>,
): RawActivity[] {
  const day = blueprint.days.find((d) => d.dayIndex === adjustDay);
  if (!day) {
    throw new Error(`Day ${adjustDay} not found in blueprint`);
  }

  const constraints = blueprint.rules.constraints ?? compileTripConstraints(plan);
  const conflicts: PlannerConflict[] = [];
  const interestCoverage = coverageThroughPriorDays(blueprint, plan, city, adjustDay);
  const ledgerNames = new Set(ledgerLandmarks);
  const usedRestaurants = new Set(ledgerRestaurants);

  const anchor = selectAnchorForDay(city, plan, day, {
    visitWindow: anchorVisitWindow(plan, day),
    ledgerNames,
    softExcludeNames: new Set(day.anchor?.landmarkName ? [day.anchor.landmarkName] : []),
    priorFullDayAnchors: priorFullDayAnchors(blueprint, adjustDay),
    constraints,
    conflicts,
    interestCoverage,
  });
  ledgerNames.add(anchor.name);

  const support = selectSupportForDay(city, plan, day, anchor, {
    visitWindow: supportVisitWindow(plan, day),
    ledgerNames,
    alreadyToday: [anchor],
    uncoveredSelectedTags: uncoveredSelectedTags(interestCoverage),
    constraints,
  });
  for (const s of support) ledgerNames.add(s.name);

  const dayWithStops: DayBlueprint = {
    ...day,
    anchor: toCommittedStop(anchor, "anchor"),
    support: support.map((s) => toCommittedStop(s, "support")),
    meals: planMealsForDay(
      {
        ...day,
        anchor: toCommittedStop(anchor, "anchor"),
        support: support.map((s) => toCommittedStop(s, "support")),
      },
      plan,
      city,
      usedRestaurants,
      { constraints, conflicts },
    ),
  };

  const adjustment = getAdjustmentContext(adjustNote, adjustDay);
  const { activities, ctx } = buildScheduleFromBlueprint(dayWithStops, plan, city, adjustNote);
  return fixRawDayActivities(activities, plan, adjustment, ctx, adjustDay);
}
