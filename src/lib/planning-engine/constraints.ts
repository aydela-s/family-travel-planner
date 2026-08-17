import type { LandmarkInterestTag } from "@/config/city-pricing";
import type { RestaurantDietary } from "@/config/city-restaurants";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { wantsNoNaps } from "@/lib/schedule/nap-policy";
import { parseDietaryTags } from "@/lib/planning-engine/dietary";
import type { TripPlan } from "@/types/trip-plan";

/**
 * Something the user explicitly requires or forbids. Hard constraints override
 * scoring: when one cannot be satisfied the planner records a PlannerConflict
 * instead of quietly picking something that breaks it.
 */
export type HardConstraint =
  | { kind: "no_naps" }
  | { kind: "exclude_interest"; tag: LandmarkInterestTag }
  | { kind: "exclude_venue"; name: string }
  | { kind: "max_drive_min"; minutes: number }
  | { kind: "dietary_required"; tags: RestaurantDietary[] };

/**
 * Something the user would like but can compromise on. These map onto existing
 * scoring weights; they are compiled here so one object describes the whole
 * request (and so "Adjust this day" can later read what was preference vs rule).
 */
export type SoftPreference =
  | { kind: "prefer_interest"; tag: LandmarkInterestTag }
  | { kind: "prefer_cheaper" }
  | { kind: "prefer_shorter_drive" }
  | { kind: "prefer_higher_rated" }
  | { kind: "prefer_dietary_fit"; tags: RestaurantDietary[] };

export type TripConstraints = {
  hard: HardConstraint[];
  soft: SoftPreference[];
};

/** Hard rules the planner enforces — user constraints plus venue facts. */
export type HardRuleKind = HardConstraint["kind"] | "venue_closed" | "age_restriction";

export const EMPTY_TRIP_CONSTRAINTS: TripConstraints = { hard: [], soft: [] };

/** Explicit "only / strictly / fully" wording turns a diet into a hard rule. */
const STRICT_DIETARY_WORDING =
  /\b(only|strictly|strict|exclusively|must\s+be|has\s+to\s+be|fully|100%|no\s+exceptions)\b/i;

export function wantsStrictDietary(plan: Pick<TripPlan, "dietaryRestrictions" | "userConstraints">): boolean {
  if (plan.userConstraints?.dietaryStrict) return true;
  const text = plan.dietaryRestrictions ?? "";
  if (!STRICT_DIETARY_WORDING.test(text)) return false;
  return parseDietaryTags(text).length > 0;
}

/** Accepts wizard labels ("Theme Parks") and raw catalog tags ("theme-parks"). */
function interestTagsFromLabels(labels: string[]): LandmarkInterestTag[] {
  const tags = new Set<LandmarkInterestTag>();
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    const mapped = interestTagsFromPlan([trimmed]);
    if (mapped.length > 0) {
      for (const tag of mapped) tags.add(tag);
    } else {
      tags.add(trimmed.toLowerCase() as LandmarkInterestTag);
    }
  }
  return [...tags];
}

/**
 * Compile the plan into hard rules + soft preferences. Pure and cheap, so any
 * stage can call it from the plan alone; the result is also stored on
 * PlanningRules so the blueprint carries the request that produced it.
 */
export function compileTripConstraints(plan: TripPlan): TripConstraints {
  const hard: HardConstraint[] = [];
  const soft: SoftPreference[] = [];
  const input = plan.userConstraints;

  // Existing behavior, now declared: "no naps" has always been a hard rule.
  if (wantsNoNaps(plan)) hard.push({ kind: "no_naps" });

  for (const tag of interestTagsFromLabels(input?.excludeInterests ?? [])) {
    hard.push({ kind: "exclude_interest", tag });
  }
  for (const name of input?.excludeVenues ?? []) {
    const trimmed = name.trim();
    if (trimmed) hard.push({ kind: "exclude_venue", name: trimmed });
  }
  if (typeof input?.maxDriveMin === "number" && input.maxDriveMin > 0) {
    hard.push({ kind: "max_drive_min", minutes: input.maxDriveMin });
  }

  const dietary = parseDietaryTags(plan.dietaryRestrictions ?? "");
  if (dietary.length > 0) {
    if (wantsStrictDietary(plan)) hard.push({ kind: "dietary_required", tags: dietary });
    else soft.push({ kind: "prefer_dietary_fit", tags: dietary });
  }

  for (const tag of interestTagsFromPlan(plan.interests)) {
    soft.push({ kind: "prefer_interest", tag });
  }
  if (plan.budgetStyle === "save") soft.push({ kind: "prefer_cheaper" });
  if (plan.travelStyle === "relaxed" || plan.walkingLimit === "low") {
    soft.push({ kind: "prefer_shorter_drive" });
  }
  if (dietary.length === 0) soft.push({ kind: "prefer_higher_rated" });

  return { hard, soft };
}

export function excludedInterestTags(constraints: TripConstraints): Set<LandmarkInterestTag> {
  const tags = new Set<LandmarkInterestTag>();
  for (const c of constraints.hard) {
    if (c.kind === "exclude_interest") tags.add(c.tag);
  }
  return tags;
}

/** Lowercased excluded names for tolerant matching against catalog names. */
export function excludedVenueNames(constraints: TripConstraints): Set<string> {
  const names = new Set<string>();
  for (const c of constraints.hard) {
    if (c.kind === "exclude_venue") names.add(c.name.trim().toLowerCase());
  }
  return names;
}

export function matchesExcludedVenue(name: string, excluded: Set<string>): boolean {
  if (excluded.size === 0) return false;
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  for (const excludedName of excluded) {
    if (needle === excludedName) return true;
    if (needle.includes(excludedName) || excludedName.includes(needle)) return true;
  }
  return false;
}

export function maxDriveMin(constraints: TripConstraints): number | null {
  for (const c of constraints.hard) {
    if (c.kind === "max_drive_min") return c.minutes;
  }
  return null;
}

export function requiredDietaryTags(constraints: TripConstraints): RestaurantDietary[] {
  for (const c of constraints.hard) {
    if (c.kind === "dietary_required") return c.tags;
  }
  return [];
}

export function findHardConstraint<K extends HardConstraint["kind"]>(
  constraints: TripConstraints,
  kind: K,
): Extract<HardConstraint, { kind: K }> | null {
  const found = constraints.hard.find((c) => c.kind === kind);
  return (found as Extract<HardConstraint, { kind: K }>) ?? null;
}

/** Plain-language description of a hard rule, used in conflict copy. */
export function describeHardConstraint(constraint: HardConstraint): string {
  switch (constraint.kind) {
    case "no_naps":
      return "no naps";
    case "exclude_interest":
      return `no ${constraint.tag}`;
    case "exclude_venue":
      return `not ${constraint.name}`;
    case "max_drive_min":
      return `at most ${constraint.minutes} min of driving`;
    case "dietary_required":
      return `${constraint.tags.join(" / ")} only`;
  }
}
