import type { LandmarkInterestTag } from "@/config/city-pricing";
import { INTEREST_LABEL_TO_TAGS } from "@/lib/schedule/interest-map";
import type { ExperienceCoverage, ExperienceCoverageItem } from "@/lib/planning-engine/staged/types";
import type { BudgetStyle, TripPlan } from "@/types/trip-plan";

/**
 * Target counts for each selected primary interest across the trip.
 * Short trips still get at least 1 for each selected interest when catalog may allow.
 */
export function targetForInterest(dayCount: number, interestCount: number): number {
  if (dayCount <= 0 || interestCount <= 0) return 0;
  if (dayCount === 1) return 1;
  if (dayCount === 2) return 1;
  return Math.max(1, Math.ceil(dayCount / Math.max(interestCount, 1)));
}

/**
 * Wizard labels → coverage keys.
 * Playgrounds & Indoor Play splits into separate outdoor vs indoor buckets.
 */
export function coverageEntriesFromInterests(
  interests: string[],
): Array<{ key: string; tag: LandmarkInterestTag; label: string }> {
  const entries: Array<{ key: string; tag: LandmarkInterestTag; label: string }> = [];
  for (const label of interests.filter(Boolean)) {
    if (label === "Playgrounds & Indoor Play" || label === "Playgrounds") {
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
  const target = targetForInterest(dayCount, Math.max(byKey.size, labels.length, 1));
  for (const item of byKey.values()) {
    item.target = target;
  }

  const budgetStyle: BudgetStyle = plan.budgetStyle || "balanced";
  const first = [...byKey.values()][0];
  if (budgetStyle === "splurge" && first) {
    byKey.set(first.key, { ...first, target: first.target + 1 });
  }

  return { items: [...byKey.values()] };
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
