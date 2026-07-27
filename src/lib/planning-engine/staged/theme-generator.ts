import type { CityConfig, LandmarkInterestTag } from "@/config/city-pricing";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import {
  THEME_CATALOG,
  themeById,
  themeGoalsAndConstraints,
  type ThemeDefinition,
} from "@/lib/planning-engine/staged/theme-catalog";
import type {
  DayBlueprint,
  DayBudgetIntent,
  ExperienceCoverage,
  ThemeId,
  TripBlueprint,
} from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";

const W_COVERAGE = 0.4;
const W_AGE = 0.25;
const W_PACE = 0.15;
const W_BUDGET = 0.1;
const W_VARIETY = 0.1;

export type ThemeScoreBreakdown = {
  themeId: ThemeId;
  total: number;
  coverageNeed: number;
  ageFit: number;
  paceFit: number;
  budgetFit: number;
  varietyBonus: number;
};

function cityHasTag(city: CityConfig, tags: LandmarkInterestTag[]): boolean {
  if (tags.length === 0) return true;
  return city.landmarks.some((l) => l.interestTags.some((t) => tags.includes(t)));
}

/** Themes available for interest-driven full days given plan + destination. */
export function eligibleInterestThemes(plan: TripPlan, city: CityConfig): ThemeDefinition[] {
  // Use all mapped tags (not primary-only) so play_indoor and playgrounds both qualify
  // when the wizard selects "Playgrounds & Indoor Play".
  const selected = new Set(interestTagsFromPlan(plan.interests));
  const selectedList = [...selected];

  return THEME_CATALOG.filter((theme) => {
    if (!theme.interestDriven) return false;
    if (!cityHasTag(city, theme.coverageTags)) return false;
    // scenic is available when nature or beaches selected (or as gap filler via mixed)
    if (theme.id === "scenic") {
      return selected.has("nature") || selected.has("beaches") || selected.has("history");
    }
    if (theme.id === "nature_parks") {
      return selected.has("parks") || selected.has("nature");
    }
    return theme.coverageTags.some((t) => selectedList.includes(t));
  });
}

function coverageNeedScore(
  theme: ThemeDefinition,
  coverage: ExperienceCoverage,
  reserved: Map<LandmarkInterestTag, number>,
): number {
  if (theme.coverageTags.length === 0) return 0.2;
  let best = 0;
  for (const tag of theme.coverageTags) {
    const item = coverage.items.find((i) => i.tag === tag);
    if (!item || item.target <= 0) continue;
    const done = item.completed + (reserved.get(tag) ?? 0);
    const remaining = Math.max(0, item.target - done);
    best = Math.max(best, remaining / item.target);
  }
  return best;
}

function ageFitScore(theme: ThemeDefinition, plan: TripPlan): number {
  const profile = getFamilyAgeProfile(plan);
  let score = 0.55;

  if (profile.hasToddler) {
    if (
      ["play_indoor", "playgrounds", "beach", "animals", "nature_parks", "recovery"].includes(
        theme.id,
      )
    ) {
      score += 0.35;
    }
    if (["history", "entertainment"].includes(theme.id)) score -= 0.15;
  }

  if (profile.hasTeen && !profile.hasToddler && !profile.hasYoungChild) {
    if (["interactive", "history", "entertainment", "scenic"].includes(theme.id)) {
      score += 0.35;
    }
    if (theme.id === "play_indoor" || theme.id === "playgrounds") score -= 0.25;
  }

  if (profile.isMixedAges) {
    if (theme.id === "play_indoor") score -= 0.1;
    if (theme.id === "playgrounds") score -= 0.05;
    if (["mixed_family", "beach", "animals", "interactive", "entertainment"].includes(theme.id)) {
      score += 0.2;
    }
  }

  return Math.min(1, Math.max(0, score));
}

function paceFitScore(theme: ThemeDefinition, plan: TripPlan): number {
  const pace = plan.travelStyle || "balanced";
  if (pace === "relaxed") {
    if (theme.highIntensity) return 0.15;
    if (["beach", "nature", "nature_parks", "scenic", "recovery"].includes(theme.id)) return 0.95;
    return 0.55;
  }
  if (pace === "packed") {
    if (theme.highIntensity) return 0.9;
    if (theme.id === "recovery") return 0.7;
    return 0.65;
  }
  if (theme.highIntensity) return 0.55;
  return 0.7;
}

function budgetFitScore(
  theme: ThemeDefinition,
  intent: DayBudgetIntent,
  budgetStyle: string,
): number {
  if (intent === "paid") return theme.typicallyPaid ? 1 : 0.35;
  if (intent === "free") return theme.typicallyPaid ? 0.25 : 1;
  // either
  if (budgetStyle === "splurge") return theme.typicallyPaid ? 0.85 : 0.55;
  if (budgetStyle === "save") return theme.typicallyPaid ? 0.4 : 0.9;
  return 0.7;
}

function varietyBonusScore(theme: ThemeDefinition, previousThemeId: ThemeId | null): number {
  if (!previousThemeId) return 1;
  if (theme.id === previousThemeId) return 0;
  // Soft penalty for same coverage family back-to-back
  const prev = themeById(previousThemeId);
  const overlap = theme.coverageTags.some((t) => prev.coverageTags.includes(t));
  return overlap ? 0.35 : 1;
}

export function scoreTheme(
  theme: ThemeDefinition,
  ctx: {
    plan: TripPlan;
    coverage: ExperienceCoverage;
    reserved: Map<LandmarkInterestTag, number>;
    dayBudgetIntent: DayBudgetIntent;
    previousThemeId: ThemeId | null;
  },
): ThemeScoreBreakdown {
  const coverageNeed = coverageNeedScore(theme, ctx.coverage, ctx.reserved);
  const ageFit = ageFitScore(theme, ctx.plan);
  const paceFit = paceFitScore(theme, ctx.plan);
  const budgetFit = budgetFitScore(
    theme,
    ctx.dayBudgetIntent,
    ctx.plan.budgetStyle || "balanced",
  );
  const varietyBonus = varietyBonusScore(theme, ctx.previousThemeId);
  const total =
    coverageNeed * W_COVERAGE +
    ageFit * W_AGE +
    paceFit * W_PACE +
    budgetFit * W_BUDGET +
    varietyBonus * W_VARIETY;

  return {
    themeId: theme.id,
    total,
    coverageNeed,
    ageFit,
    paceFit,
    budgetFit,
    varietyBonus,
  };
}

function fullDayCount(blueprint: TripBlueprint): number {
  return blueprint.days.filter((d) => d.role === "full").length;
}

/**
 * Budget cadence — not strict alternate.
 * Save: mostly free; paid only when needed.
 * Balanced: ~40–60% paid; avoid consecutive expensive days.
 * Splurge: mostly paid.
 */
export function budgetIntentForFullDay(
  plan: TripPlan,
  fullDayIndex: number,
  previousPaid: boolean,
  themeTypicallyPaid: boolean,
): DayBudgetIntent {
  const style = plan.budgetStyle || "balanced";

  if (style === "save") {
    return themeTypicallyPaid ? "paid" : "free";
  }

  if (style === "splurge") {
    return themeTypicallyPaid || fullDayIndex % 3 !== 2 ? "paid" : "either";
  }

  // balanced: aim ~50% paid, avoid consecutive expensive
  if (previousPaid && themeTypicallyPaid) return "either";
  if (previousPaid) return "free";
  // Prefer paid on even full-day indices when theme can be paid
  if (themeTypicallyPaid && fullDayIndex % 2 === 0) return "paid";
  if (!themeTypicallyPaid && fullDayIndex % 2 === 1) return "free";
  return themeTypicallyPaid ? "paid" : "free";
}

function reserveCoverage(
  reserved: Map<LandmarkInterestTag, number>,
  tags: LandmarkInterestTag[],
): void {
  for (const tag of tags) {
    reserved.set(tag, (reserved.get(tag) ?? 0) + 1);
  }
}

function applyStructuralTheme(
  day: DayBlueprint,
  themeId: "arrival" | "departure" | "recovery",
): DayBlueprint {
  const theme = themeById(themeId);
  return {
    ...day,
    role: themeId === "recovery" ? "recovery" : day.role,
    theme: {
      id: theme.id,
      label: theme.label,
      primaryTags: theme.coverageTags,
      secondaryTags: [],
      preferredExperienceTypes: theme.preferredExperienceTypes,
    },
  };
}

function applyInterestTheme(
  day: DayBlueprint,
  theme: ThemeDefinition,
  plan: TripPlan,
  dayBudgetIntent: DayBudgetIntent,
): DayBlueprint {
  if (day.role === "arrival" || day.role === "departure") {
    return applyStructuralTheme(day, day.role);
  }

  const profile = getFamilyAgeProfile(plan);
  const { goals: themeGoals, constraints: themeConstraints } = themeGoalsAndConstraints(theme, {
    hasNaps: (plan.naps?.length ?? 0) > 0,
    isMixedAges: profile.isMixedAges,
    dayBudgetIntent,
  });

  // Full/recovery days: theme goals replace empty strategy goals; keep role constraints for recovery.
  const goals = [...themeGoals];
  const constraints =
    day.role === "recovery"
      ? [...day.constraints, ...themeConstraints]
      : [...themeConstraints];

  return {
    ...day,
    role: theme.id === "recovery" ? "recovery" : day.role,
    theme: {
      id: theme.id,
      label: theme.label,
      primaryTags: theme.coverageTags,
      secondaryTags: theme.preferredExperienceTypes.filter(
        (t) => !theme.coverageTags.includes(t),
      ),
      preferredExperienceTypes: theme.preferredExperienceTypes,
    },
    goals,
    constraints,
    dayBudgetIntent,
  };
}

/**
 * Daily Theme Generator — strategy layer.
 * Assigns internal theme ids, goals, constraints, and dayBudgetIntent.
 * Does not pick POIs. Shadow-safe: mutates blueprint only.
 */
export function applyDailyThemes(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
): TripBlueprint {
  const eligible = eligibleInterestThemes(plan, city);
  const reserved = new Map<LandmarkInterestTag, number>();
  const consumeRareOnArrivalDeparture = fullDayCount(blueprint) <= 2;
  let previousThemeId: ThemeId | null = null;
  let previousPaid = false;
  let fullDayIndex = 0;
  let forceRecoveryNext = false;

  const days = blueprint.days.map((day) => {
    if (day.role === "arrival") {
      const next = applyStructuralTheme(day, "arrival");
      previousThemeId = "arrival";
      if (consumeRareOnArrivalDeparture && eligible[0]) {
        // Optional soft coverage: do not reserve rare tags on arrival.
      }
      return next;
    }

    if (day.role === "departure") {
      const next = applyStructuralTheme(day, "departure");
      previousThemeId = "departure";
      return next;
    }

    // Recovery forced after high-intensity day
    const pace = plan.travelStyle || "balanced";
    if (forceRecoveryNext && pace !== "relaxed") {
      forceRecoveryNext = false;
      const recovery = themeById("recovery");
      const intent: DayBudgetIntent = "free";
      const next = applyInterestTheme(
        { ...day, role: "recovery" },
        recovery,
        plan,
        intent,
      );
      previousThemeId = "recovery";
      previousPaid = false;
      fullDayIndex += 1;
      return next;
    }

    forceRecoveryNext = false;

    let candidates = eligible.filter((t) => t.id !== previousThemeId);
    if (candidates.length === 0) candidates = [...eligible];

    const ranked = candidates
      .map((theme) => ({
        theme,
        breakdown: scoreTheme(theme, {
          plan,
          coverage: blueprint.experienceCoverage,
          reserved,
          dayBudgetIntent: budgetIntentForFullDay(
            plan,
            fullDayIndex,
            previousPaid,
            theme.typicallyPaid,
          ),
          previousThemeId,
        }),
      }))
      .sort((a, b) => b.breakdown.total - a.breakdown.total);

    let chosen = ranked[0]?.theme ?? themeById("mixed_family");

    // Prefer a theme that still advances coverage when the top pick covers nothing left.
    if (
      chosen.coverageTags.length > 0 &&
      coverageNeedScore(chosen, blueprint.experienceCoverage, reserved) === 0 &&
      ranked.some((r) => r.breakdown.coverageNeed > 0)
    ) {
      chosen = ranked.find((r) => r.breakdown.coverageNeed > 0)?.theme ?? chosen;
    }

    const intent = budgetIntentForFullDay(
      plan,
      fullDayIndex,
      previousPaid,
      chosen.typicallyPaid,
    );

    const next = applyInterestTheme(day, chosen, plan, intent);
    reserveCoverage(reserved, chosen.coverageTags);
    previousThemeId = chosen.id;
    previousPaid = intent === "paid" || (intent === "either" && chosen.typicallyPaid);
    fullDayIndex += 1;

    if (
      chosen.highIntensity &&
      pace !== "relaxed" &&
      remainingFullDaysAfter(blueprint, day) >= 1
    ) {
      forceRecoveryNext = true;
    }

    return next;
  });

  // Remaining coverage gaps → reassign a soft full day to a theme that covers the gap
  // (prefer real coverage themes over mixed_family). Never steal the sole cover of another gap.
  const gapTags = blueprint.experienceCoverage.items
    .map((i) => ({
      ...i,
      remaining: Math.max(0, i.target - (i.completed + (reserved.get(i.tag) ?? 0))),
    }))
    .filter((i) => i.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  let adjusted = [...days];

  const dayCoversTag = (d: DayBlueprint, tag: LandmarkInterestTag): boolean => {
    if (d.role !== "full" && d.role !== "recovery") return false;
    const def = THEME_CATALOG.find((t) => t.id === d.theme.id);
    return def?.coverageTags.includes(tag) ?? false;
  };

  const isSoleCoverForOtherGap = (dayIndex: number, gapTag: LandmarkInterestTag): boolean => {
    const day = adjusted[dayIndex]!;
    const def = THEME_CATALOG.find((t) => t.id === day.theme.id);
    if (!def) return false;
    return gapTags.some((g) => {
      if (g.tag === gapTag) return false;
      if (!def.coverageTags.includes(g.tag)) return false;
      const otherCovers = adjusted.some(
        (d, j) => j !== dayIndex && dayCoversTag(d, g.tag),
      );
      return !otherCovers;
    });
  };

  for (const gap of gapTags) {
    if (adjusted.some((d) => dayCoversTag(d, gap.tag))) continue;

    const cover =
      eligible.find((t) => t.coverageTags.includes(gap.tag)) ??
      THEME_CATALOG.find(
        (t) =>
          t.interestDriven &&
          t.coverageTags.includes(gap.tag) &&
          cityHasTag(city, t.coverageTags),
      ) ??
      themeById("mixed_family");

    const canPlaceAt = (i: number): boolean => {
      const prevId = adjusted[i - 1]?.theme.id;
      const nextId = adjusted[i + 1]?.theme.id;
      return cover.id !== prevId && cover.id !== nextId;
    };

    // Prefer replacing filler themes, then duplicates, then non-sole-cover days.
    let idx = adjusted.findIndex(
      (d, i) => d.role === "full" && d.theme.id === "mixed_family" && canPlaceAt(i),
    );
    if (idx < 0) {
      idx = adjusted.findIndex(
        (d, i) =>
          d.role === "full" &&
          (d.theme.id === "scenic" || d.theme.id === "recovery") &&
          canPlaceAt(i),
      );
    }
    if (idx < 0) {
      idx = adjusted.findIndex((d, i) => {
        if (d.role !== "full" || !canPlaceAt(i)) return false;
        const def = THEME_CATALOG.find((t) => t.id === d.theme.id);
        if (!def || def.highIntensity) return false;
        return adjusted.some(
          (other, j) => j !== i && other.role === "full" && other.theme.id === d.theme.id,
        );
      });
    }
    if (idx < 0) {
      idx = adjusted.findIndex((d, i) => {
        if (d.role !== "full" || !canPlaceAt(i)) return false;
        const def = THEME_CATALOG.find((t) => t.id === d.theme.id);
        if (!def || def.highIntensity) return false;
        if (isSoleCoverForOtherGap(i, gap.tag)) return false;
        // Prefer replacing themes that are not dedicated play/beach when filling play gaps
        return true;
      });
    }
    // Play buckets are easy to starve on short trips — allow replacing entertainment/scenic.
    if (
      idx < 0 &&
      (gap.tag === "indoor-play" || gap.tag === "playgrounds")
    ) {
      idx = adjusted.findIndex(
        (d, i) =>
          d.role === "full" &&
          canPlaceAt(i) &&
          (d.theme.id === "entertainment" || d.theme.id === "scenic" || d.theme.id === "shopping"),
      );
    }
    if (idx < 0) continue;

    const day = adjusted[idx]!;
    adjusted[idx] = applyInterestTheme(day, cover, plan, day.dayBudgetIntent);
    reserveCoverage(reserved, cover.coverageTags);
  }

  return { ...blueprint, days: adjusted };
}

function remainingFullDaysAfter(blueprint: TripBlueprint, day: DayBlueprint): number {
  return blueprint.days.filter((d) => d.dayIndex > day.dayIndex && d.role === "full").length;
}
