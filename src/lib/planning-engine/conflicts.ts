import type { DietaryFit } from "@/lib/planning-engine/restaurant-picker";
import type { HardConstraint, HardRuleKind } from "@/lib/planning-engine/constraints";

export type PlannerConflictCode =
  | "no_open_venue"
  | "no_age_appropriate_venue"
  | "dietary_unreachable"
  | "drive_limit_exceeded"
  | "exclusion_leaves_nothing";

export type ConflictSlot = "anchor" | "support" | "breakfast" | "lunch" | "dinner";

/**
 * A real candidate the planner considered, with the measured cost of using it.
 * Enough for a future "Adjust this day" turn to lay out the trade-off without
 * re-deriving anything.
 */
export type ConflictOption = {
  kind: "venue" | "restaurant";
  name: string;
  placeId?: string;
  dietaryFit?: DietaryFit;
  /** Extra driving this option would add, when measurable. */
  extraDriveMin?: number;
  detourKm?: number;
  /** Which hard rules this option breaks (empty = breaks none). */
  violates: HardRuleKind[];
  /** Deterministic why-string, e.g. "30 min detour exceeds the 15 min limit". */
  reason: string;
};

/**
 * A hard requirement the planner could not satisfy. Never produced for soft
 * preferences. `chosen` is set only when the pipeline required something to fill
 * the slot and the fallback breaks the rule — so a violation is always visible.
 */
export type PlannerConflict = {
  code: PlannerConflictCode;
  rule: HardRuleKind;
  /** Present when the rule came from an explicit user constraint. */
  constraint?: HardConstraint;
  scope: { day?: number; slot?: ConflictSlot };
  message: string;
  options: ConflictOption[];
  chosen?: ConflictOption;
};

export function conflictKey(conflict: PlannerConflict): string {
  return [
    conflict.code,
    conflict.rule,
    conflict.scope.day ?? "-",
    conflict.scope.slot ?? "-",
    conflict.chosen?.name ?? "-",
  ].join("|");
}

/** Append conflicts, dropping repeats of the same rule for the same slot. */
export function mergeConflicts(
  existing: PlannerConflict[],
  incoming: PlannerConflict[],
): PlannerConflict[] {
  const seen = new Set(existing.map(conflictKey));
  const out = [...existing];
  for (const conflict of incoming) {
    const key = conflictKey(conflict);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(conflict);
  }
  return out;
}

/** Mutable sink so selection stages can report without changing return types. */
export function recordConflict(
  sink: PlannerConflict[] | undefined,
  conflict: PlannerConflict,
): void {
  if (!sink) return;
  const key = conflictKey(conflict);
  if (sink.some((c) => conflictKey(c) === key)) return;
  sink.push(conflict);
}
