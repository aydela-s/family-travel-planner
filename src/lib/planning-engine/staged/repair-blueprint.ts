import type { CityConfig } from "@/config/city-pricing";
import {
  selectAnchorForDay,
  toCommittedStop,
} from "@/lib/planning-engine/staged/anchor-selector";
import { planMealsForDay } from "@/lib/planning-engine/staged/meal-planner";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import { validateBlueprint } from "@/lib/planning-engine/staged/validate-blueprint";
import type {
  DayBlueprint,
  TripBlueprint,
  ValidationViolation,
} from "@/lib/planning-engine/staged/types";
import { compileTripConstraints, type TripConstraints } from "@/lib/planning-engine/constraints";
import { mergeConflicts, type PlannerConflict } from "@/lib/planning-engine/conflicts";
import {
  anchorVisitWindow,
  supportVisitWindow,
} from "@/lib/planning-engine/staged/visit-windows";
import type { TripPlan } from "@/types/trip-plan";

function rebuildLedgerLandmarks(days: DayBlueprint[]): string[] {
  const names: string[] = [];
  for (const day of days) {
    if (day.anchor) names.push(day.anchor.landmarkName);
    for (const s of day.support) names.push(s.landmarkName);
  }
  return [...new Set(names)];
}

function rebuildLedgerRestaurants(days: DayBlueprint[]): string[] {
  const names: string[] = [];
  for (const day of days) {
    for (const m of day.meals) {
      if (m.restaurantName) names.push(m.restaurantName);
    }
  }
  return [...new Set(names)];
}

function repairAnchorForDay(
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
  ledgerNames: Set<string>,
  badNames: Set<string>,
  priorFullDayAnchors: Set<string>,
  ctx: { constraints: TripConstraints; conflicts: PlannerConflict[] },
): DayBlueprint {
  if (day.anchor) ledgerNames.delete(day.anchor.landmarkName);
  for (const s of day.support) ledgerNames.delete(s.landmarkName);

  const softExclude = new Set(badNames);
  if (day.anchor) softExclude.add(day.anchor.landmarkName);

  const anchor = selectAnchorForDay(city, plan, day, {
    visitWindow: anchorVisitWindow(plan, day),
    ledgerNames,
    softExcludeNames: softExclude,
    priorFullDayAnchors,
    constraints: ctx.constraints,
    conflicts: ctx.conflicts,
  });
  ledgerNames.add(anchor.name);

  const support = selectSupportForDay(city, plan, day, anchor, {
    visitWindow: supportVisitWindow(plan, day),
    ledgerNames,
    alreadyToday: [anchor],
    constraints: ctx.constraints,
  });
  for (const s of support) ledgerNames.add(s.name);

  return {
    ...day,
    anchor: toCommittedStop(anchor, "anchor"),
    support: support.map((s) => toCommittedStop(s, "support")),
  };
}

function repairMealsForDay(
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
  usedRestaurants: Set<string>,
  ctx: { constraints: TripConstraints; conflicts: PlannerConflict[] },
): DayBlueprint {
  for (const m of day.meals) {
    if (m.restaurantName) usedRestaurants.delete(m.restaurantName);
  }
  return {
    ...day,
    meals: planMealsForDay(day, plan, city, usedRestaurants, ctx),
  };
}

/**
 * One-pass day-scoped repair. Regenerates only the affected day components.
 * Does not rebuild themes or other days' anchors.
 */
export function repairBlueprint(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
  violations: ValidationViolation[],
): TripBlueprint {
  if (violations.length === 0) return blueprint;

  const byDay = new Map<number, ValidationViolation[]>();
  for (const v of violations) {
    if (v.day == null) continue;
    const list = byDay.get(v.day) ?? [];
    list.push(v);
    byDay.set(v.day, list);
  }
  if (byDay.size === 0) return blueprint;

  const days = [...blueprint.days];
  const ledgerNames = new Set(blueprint.ledger.landmarkNames);
  const usedRestaurants = new Set(blueprint.ledger.restaurantNames);
  const ctx = {
    constraints: blueprint.rules.constraints ?? compileTripConstraints(plan),
    conflicts: [] as PlannerConflict[],
  };

  for (const [dayIndex, dayViolations] of byDay) {
    const idx = days.findIndex((d) => d.dayIndex === dayIndex);
    if (idx < 0) continue;
    let day = days[idx]!;

    const needsAnchor = dayViolations.some(
      (v) =>
        v.repairHint === "regenerate_anchor" ||
        v.repairHint === "regenerate_day" ||
        v.repairHint === "regenerate_support",
    );
    const needsMeals =
      needsAnchor ||
      dayViolations.some(
        (v) => v.repairHint === "regenerate_meals" || v.repairHint === "regenerate_day",
      );

    const badNames = new Set(
      dayViolations
        .map((v) => {
          const m = v.message.match(/"([^"]+)"/);
          return m?.[1];
        })
        .filter((n): n is string => Boolean(n)),
    );

    if (needsAnchor) {
      const priorFullDayAnchors = new Set(
        days
          .filter((d) => d.dayIndex !== dayIndex && d.role === "full" && d.anchor)
          .map((d) => d.anchor!.landmarkName),
      );
      day = repairAnchorForDay(
        day,
        plan,
        city,
        ledgerNames,
        badNames,
        priorFullDayAnchors,
        ctx,
      );
    }

    if (needsMeals) {
      day = repairMealsForDay(day, plan, city, usedRestaurants, ctx);
    }

    days[idx] = day;
  }

  return {
    ...blueprint,
    days,
    conflicts: mergeConflicts(blueprint.conflicts ?? [], ctx.conflicts),
    ledger: {
      ...blueprint.ledger,
      landmarkNames: rebuildLedgerLandmarks(days),
      restaurantNames: rebuildLedgerRestaurants(days),
    },
  };
}

/** Validate then repair once; returns repaired blueprint. */
export function validateAndRepairBlueprint(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
): { blueprint: TripBlueprint; violations: ValidationViolation[]; repaired: boolean } {
  const before = validateBlueprint(blueprint, plan, city);
  if (before.length === 0) {
    return { blueprint, violations: [], repaired: false };
  }
  const repairedBp = repairBlueprint(blueprint, plan, city, before);
  const after = validateBlueprint(repairedBp, plan, city);
  return { blueprint: repairedBp, violations: after, repaired: true };
}
