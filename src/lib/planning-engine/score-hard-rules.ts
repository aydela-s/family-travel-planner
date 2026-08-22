import type { CityConfig, Landmark } from "@/config/city-pricing";
import type { TripConstraints } from "@/lib/planning-engine/constraints";
import { isEligibleStop } from "@/lib/planning-engine/staged/eligibility";
import { filterAnchorsByInterestCoverage } from "@/lib/planning-engine/staged/interest-coverage-gates";
import {
  isLongShoppingExperience,
  isThemeParkExperience,
  pairingAllowedForDay,
} from "@/lib/planning-engine/staged/landmark-experience";
import type { ExperienceCoverage } from "@/lib/planning-engine/staged/types";
import type { VisitWindow } from "@/lib/schedule/landmark-hours";
import type { TripPlan } from "@/types/trip-plan";

export type ScoreHardRuleContext = {
  plan: TripPlan;
  city: CityConfig;
  constraints: TripConstraints;
  visitWindow?: VisitWindow;
  coverage?: ExperienceCoverage;
  /** When false, skip interest-coverage gates (e.g. pool exhausted). */
  applyInterestGates?: boolean;
  alreadyPicked: Landmark[];
  excludeNames: Set<string>;
  /** 0 = morning, 1 = afternoon, 2 = extra */
  slotIndex: number;
};

/**
 * Shared FAM-84 hard gates for the legacy score path — eligibility, pairing,
 * interest coverage, and slot placement (theme park / long shopping).
 */
export function filterScoreLandmarkCandidates(
  pool: Landmark[],
  ctx: ScoreHardRuleContext,
): Landmark[] {
  if (pool.length === 0) return pool;

  let next = pool;

  if (ctx.slotIndex === 0 || ctx.slotIndex >= 2) {
    const withoutHeavy = next.filter(
      (l) => !isThemeParkExperience(l) && !isLongShoppingExperience(l),
    );
    if (withoutHeavy.length > 0) next = withoutHeavy;
  }

  if (ctx.alreadyPicked.length > 0) {
    next = next.filter((candidate) =>
      ctx.alreadyPicked.every((picked) => pairingAllowedForDay(picked, candidate)),
    );
  }

  if (ctx.visitWindow) {
    const open = next.filter((l) =>
      isEligibleStop(l, {
        plan: ctx.plan,
        constraints: ctx.constraints,
        visitWindow: ctx.visitWindow,
      }),
    );
    if (open.length > 0) next = open;
  } else {
    const eligible = next.filter((l) =>
      isEligibleStop(l, { plan: ctx.plan, constraints: ctx.constraints }),
    );
    if (eligible.length > 0) next = eligible;
  }

  if (ctx.coverage && ctx.applyInterestGates !== false) {
    const gated = filterAnchorsByInterestCoverage(next, ctx.plan, ctx.coverage, ctx.city, {
      excludeNames: ctx.excludeNames,
      constraints: ctx.constraints,
      visitWindow: ctx.visitWindow,
      applyGates: true,
    });
    if (gated.length > 0) next = gated;
  }

  return next;
}
