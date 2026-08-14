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
import { addDays } from "@/lib/format";
import { morningActivityDefaultTime } from "@/lib/planning-engine/skeleton-builder";
import { getNapWindow, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import { minutesToTime, parseTimeToMinutes } from "@/lib/schedule/timeline";
import type { VisitWindow } from "@/lib/schedule/landmark-hours";
import type { TripPlan } from "@/types/trip-plan";

function visitWindowFromTime(
  startTime: string,
  durationMin: number,
  visitDate: string,
): VisitWindow {
  const startMin = parseTimeToMinutes(startTime);
  return { startMin, endMin: startMin + durationMin, visitDate };
}

function anchorVisitWindow(plan: TripPlan, day: DayBlueprint): VisitWindow {
  const activityMins = Math.max(
    day.capacity.activityDurationMin,
    day.constraints.some((c) => c.type === "require_half_day_window") ? 240 : 0,
  );
  const visitDate = day.date || addDays(plan.startDate, day.dayIndex - 1);
  const nap = shouldIncludeNaps(plan) ? getNapWindow(plan) : null;
  const halfDay = day.constraints.some((c) => c.type === "require_half_day_window");
  if (halfDay) {
    const start = nap
      ? minutesToTime(Math.min(nap.endMin + 15, 16 * 60))
      : "13:15";
    return visitWindowFromTime(start, Math.max(activityMins, 240), visitDate);
  }
  if (day.capacity.maxActivitiesPerDay <= 1 || day.role === "departure") {
    return visitWindowFromTime(morningActivityDefaultTime(plan), activityMins, visitDate);
  }
  const start = nap ? minutesToTime(Math.min(nap.endMin + 15, 16 * 60)) : "13:15";
  return visitWindowFromTime(start, activityMins, visitDate);
}

function supportVisitWindow(plan: TripPlan, day: DayBlueprint): VisitWindow {
  const visitDate = day.date || addDays(plan.startDate, day.dayIndex - 1);
  return visitWindowFromTime(
    morningActivityDefaultTime(plan),
    day.capacity.activityDurationMin,
    visitDate,
  );
}

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
): DayBlueprint {
  if (day.anchor) ledgerNames.delete(day.anchor.landmarkName);
  for (const s of day.support) ledgerNames.delete(s.landmarkName);

  const softExclude = new Set(badNames);
  if (day.anchor) softExclude.add(day.anchor.landmarkName);

  const anchor = selectAnchorForDay(city, plan, day, {
    visitWindow: anchorVisitWindow(plan, day),
    ledgerNames,
    softExcludeNames: softExclude,
  });
  ledgerNames.add(anchor.name);

  const support = selectSupportForDay(city, plan, day, anchor, {
    visitWindow: supportVisitWindow(plan, day),
    ledgerNames,
    alreadyToday: [anchor],
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
): DayBlueprint {
  for (const m of day.meals) {
    if (m.restaurantName) usedRestaurants.delete(m.restaurantName);
  }
  return {
    ...day,
    meals: planMealsForDay(day, plan, city, usedRestaurants),
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
      day = repairAnchorForDay(day, plan, city, ledgerNames, badNames);
    }

    if (needsMeals) {
      day = repairMealsForDay(day, plan, city, usedRestaurants);
    }

    days[idx] = day;
  }

  return {
    ...blueprint,
    days,
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
