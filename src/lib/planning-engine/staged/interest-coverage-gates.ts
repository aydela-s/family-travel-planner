import type { CityConfig, Landmark, LandmarkInterestTag } from "@/config/city-pricing";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import type { VisitWindow } from "@/lib/schedule/landmark-hours";
import type { TripConstraints } from "@/lib/planning-engine/constraints";
import { isEligibleStop } from "@/lib/planning-engine/staged/eligibility";
import {
  awaitingFirstCoverageTags,
  uncoveredSelectedTags,
} from "@/lib/planning-engine/staged/experience-coverage";
import type { ExperienceCoverage } from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";

export function selectedTagsOnLandmark(
  landmark: Landmark,
  selected: Set<LandmarkInterestTag>,
): LandmarkInterestTag[] {
  return landmark.interestTags.filter((t) => selected.has(t));
}

export function cityHasEligibleForInterestTags(
  city: CityConfig,
  plan: TripPlan,
  tags: LandmarkInterestTag[],
  excludeNames: Set<string>,
  constraints: TripConstraints,
  visitWindow?: VisitWindow,
): boolean {
  if (tags.length === 0) return false;
  const tagSet = new Set(tags);
  return city.landmarks.some(
    (l) =>
      !excludeNames.has(l.name) &&
      l.interestTags.some((t) => tagSet.has(t)) &&
      isEligibleStop(l, { plan, constraints, visitWindow }),
  );
}

/** Rule 10: anchor would repeat a covered interest while others have zero stops. */
export function anchorRepeatsBeforeFullCoverage(
  landmark: Landmark,
  coverage: ExperienceCoverage,
  selected: Set<LandmarkInterestTag>,
): boolean {
  const awaiting = awaitingFirstCoverageTags(coverage);
  if (awaiting.length === 0) return false;

  const onLandmark = selectedTagsOnLandmark(landmark, selected);
  if (onLandmark.length === 0) return false;
  if (onLandmark.some((t) => awaiting.includes(t))) return false;

  return onLandmark.every((t) => {
    const item = coverage.items.find((i) => i.tag === t && i.source === "interest");
    return item != null && item.completed > 0;
  });
}

/** Rule 9 at anchor tier: landmark matches none of the family's selected interests. */
export function anchorIsUnselectedWhileUncovered(
  landmark: Landmark,
  selected: Set<LandmarkInterestTag>,
): boolean {
  return selected.size > 0 && selectedTagsOnLandmark(landmark, selected).length === 0;
}

export function interestTierForAnchor(
  landmark: Landmark,
  coverage: ExperienceCoverage,
  selected: Set<LandmarkInterestTag>,
): number {
  const awaiting = awaitingFirstCoverageTags(coverage);
  const uncovered = uncoveredSelectedTags(coverage);
  const onLandmark = selectedTagsOnLandmark(landmark, selected);
  if (onLandmark.some((t) => awaiting.includes(t))) return 0;
  if (onLandmark.some((t) => uncovered.includes(t))) return 1;
  if (onLandmark.length > 0) return 2;
  return 3;
}

export function filterAnchorsByInterestCoverage(
  candidates: Landmark[],
  plan: TripPlan,
  coverage: ExperienceCoverage,
  city: CityConfig,
  opts: {
    excludeNames: Set<string>;
    constraints: TripConstraints;
    visitWindow?: VisitWindow;
    applyGates: boolean;
  },
): Landmark[] {
  if (!opts.applyGates || plan.interests.length === 0 || candidates.length === 0) {
    return candidates;
  }

  const selected = new Set(interestTagsFromPlan(plan.interests));
  const uncovered = uncoveredSelectedTags(coverage);
  const awaiting = awaitingFirstCoverageTags(coverage);

  const hasUncoveredCandidate = cityHasEligibleForInterestTags(
    city,
    plan,
    uncovered,
    opts.excludeNames,
    opts.constraints,
    opts.visitWindow,
  );
  const hasAwaitingCandidate = cityHasEligibleForInterestTags(
    city,
    plan,
    awaiting,
    opts.excludeNames,
    opts.constraints,
    opts.visitWindow,
  );

  const gated = candidates.filter((lm) => {
    if (anchorIsUnselectedWhileUncovered(lm, selected) && hasUncoveredCandidate) {
      return false;
    }
    if (
      hasAwaitingCandidate &&
      anchorRepeatsBeforeFullCoverage(lm, coverage, selected)
    ) {
      return false;
    }
    return true;
  });

  return gated;
}
