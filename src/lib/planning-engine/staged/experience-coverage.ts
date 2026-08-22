import type { LandmarkInterestTag } from "@/config/city-pricing";
import { INTEREST_LABEL_TO_TAGS } from "@/lib/schedule/interest-map";
import type { ExperienceCoverage, ExperienceCoverageItem } from "@/lib/planning-engine/staged/types";
import type { BudgetStyle, TripPlan } from "@/types/trip-plan";

/**
 * Target counts for each selected primary interest across the trip.
 * Short trips still get at least 1 for each selected interest when catalog may allow.
 * Shopping is capped at 1 on multi-interest trips so malls don't dominate.
 */
export function targetForInterest(dayCount: number, interestCount: number): number {
  if (dayCount <= 0 || interestCount <= 0) return 0;
  if (dayCount === 1) return 1;
  if (dayCount === 2) return 1;
  return Math.max(1, Math.ceil(dayCount / Math.max(interestCount, 1)));
}

/** Per-tag ceiling — shopping stays a highlight, not half the trip. */
export function maxTargetForInterestTag(
  tag: LandmarkInterestTag,
  dayCount: number,
  interestCount: number,
): number | null {
  if (tag !== "shopping") return null;
  if (interestCount <= 1) {
    return Math.max(1, Math.ceil(dayCount / 2));
  }
  // Multi-interest: at most one dedicated shopping experience on trips ≤5 days.
  if (dayCount <= 5) return 1;
  return 2;
}

/**
 * Wizard labels → coverage keys.
 * Indoor & Outdoor Play splits into separate outdoor vs indoor buckets.
 */
export function coverageEntriesFromInterests(
  interests: string[],
): Array<{ key: string; tag: LandmarkInterestTag; label: string }> {
  const entries: Array<{ key: string; tag: LandmarkInterestTag; label: string }> = [];
  for (const label of interests.filter(Boolean)) {
    if (
      label === "Indoor & Outdoor Play" ||
      label === "Playgrounds & Indoor Play" ||
      label === "Playgrounds"
    ) {
      entries.push({ key: "playgrounds", tag: "playgrounds", label });
      entries.push({ key: "indoor-play", tag: "indoor-play", label });
      continue;
    }
    const tag = INTEREST_LABEL_TO_TAGS[label]?.[0];
    if (!tag) continue;
    entries.push({ key: tag, tag, label });
  }
  return entries;
}

export function buildExperienceCoverageTargets(
  plan: TripPlan,
  dayCount: number,
): ExperienceCoverage {
  const labels = plan.interests.filter(Boolean);
  const entries = coverageEntriesFromInterests(labels);

  const byKey = new Map<string, ExperienceCoverageItem>();
  for (const e of entries) {
    if (!byKey.has(e.key)) {
      byKey.set(e.key, {
        key: e.key,
        tag: e.tag,
        label: e.label,
        target: 0,
        completed: 0,
        source: "interest",
      });
    }
  }

  // Target from unique coverage buckets (playgrounds + indoor-play are separate),
  // so a 5-day / 4-interest trip does not demand 2× every split bucket.
  const bucketCount = Math.max(byKey.size, labels.length, 1);
  const baseTarget = targetForInterest(dayCount, bucketCount);
  for (const item of byKey.values()) {
    const capped = maxTargetForInterestTag(item.tag, dayCount, bucketCount);
    item.target = capped == null ? baseTarget : Math.min(baseTarget, capped);
  }

  const budgetStyle: BudgetStyle = plan.budgetStyle || "balanced";
  const first = [...byKey.values()][0];
  if (budgetStyle === "splurge" && first && first.tag !== "shopping") {
    byKey.set(first.key, { ...first, target: first.target + 1 });
  }

  return { items: [...byKey.values()] };
}

/** Selected interests still below their trip target — prioritize before anything else. */
export function uncoveredSelectedTags(coverage: ExperienceCoverage): LandmarkInterestTag[] {
  return coverage.items
    .filter((item) => item.source === "interest" && item.completed < item.target)
    .map((item) => item.tag);
}

/** Selected interests that have not yet received a first scheduled stop (FAM-84 rule 10). */
export function awaitingFirstCoverageTags(coverage: ExperienceCoverage): LandmarkInterestTag[] {
  return coverage.items
    .filter((item) => item.source === "interest" && item.target > 0 && item.completed === 0)
    .map((item) => item.tag);
}

/** Remaining experiences still needed (target − completed, floored at 0). */
export function remainingExperiences(coverage: ExperienceCoverage): ExperienceCoverageItem[] {
  return coverage.items
    .map((i) => ({ ...i, target: Math.max(0, i.target - i.completed), completed: 0 }))
    .filter((i) => i.target > 0);
}

export function markExperienceCompleted(
  coverage: ExperienceCoverage,
  tags: LandmarkInterestTag[],
): ExperienceCoverage {
  if (tags.length === 0) return coverage;
  const tagSet = new Set(tags);
  return {
    items: coverage.items.map((item) =>
      tagSet.has(item.tag)
        ? { ...item, completed: Math.min(item.target, item.completed + 1) }
        : item,
    ),
  };
}

/** Mark by coverage key (when tag aliasing would be ambiguous). */
export function markExperienceCompletedByKeys(
  coverage: ExperienceCoverage,
  keys: string[],
): ExperienceCoverage {
  if (keys.length === 0) return coverage;
  const keySet = new Set(keys);
  return {
    items: coverage.items.map((item) =>
      keySet.has(item.key)
        ? { ...item, completed: Math.min(item.target, item.completed + 1) }
        : item,
    ),
  };
}
