/**
 * Daily activity-load model (FAM-76 / FAM-77).
 *
 * Travel style sets the preference; age scales the budget; each stop costs
 * load from duration × intensity (+ travel). Support slots are gated by
 * remaining budget so a long zoo does not get stacked with another heavy stop.
 */

import type { Landmark, LandmarkIntensity, LandmarkInterestTag } from "@/config/city-pricing";
import {
  INTEREST_CATEGORY_DEFAULTS,
  type InterestCategoryDefaults,
} from "@/lib/schedule/interest-category-defaults";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import type { TripPlan, TravelStyle } from "@/types/trip-plan";

/** Youngest traveler drives mixed-age pacing (FAM-76). */
export type ActivityLoadAgeBand = "young" | "school" | "adult";

export function activityLoadAgeBand(plan: TripPlan): ActivityLoadAgeBand {
  const profile = getFamilyAgeProfile(plan);
  if (profile.youngest == null) return "adult";
  if (profile.youngest <= 7) return "young"; // toddler or young child
  if (profile.youngest <= 12) return "school";
  return "adult";
}

const INTENSITY_FACTOR: Record<LandmarkIntensity, number> = {
  low: 0.85,
  medium: 1,
  high: 1.4,
};

const ENERGY_FACTOR: Record<"low" | "medium" | "high", number> = {
  low: 0.9,
  medium: 1,
  high: 1.25,
};

/** Typical visit minutes from interest-category defaults (midpoint of min–max). */
export function typicalDurationMinForLandmark(landmark: Landmark): number {
  const defaults = bestCategoryDefaults(landmark.interestTags);
  if (!defaults) return 90;
  return Math.round((defaults.durationMin + defaults.durationMax) / 2);
}

const WATER_PLAY_NAME =
  /\b(water\s*park|waterpark|aquatic|swim(ming)?|pool|splash\s*pad|hawaiian\s+waters)\b/i;

function durationBandFromYoungest(youngest: number | null): ActivityLoadAgeBand {
  if (youngest == null) return "adult";
  if (youngest <= 7) return "young";
  if (youngest <= 12) return "school";
  return "adult";
}

function lerpDuration(min: number, max: number, band: ActivityLoadAgeBand): number {
  if (band === "young") return min;
  if (band === "school") return Math.round((min + max) / 2);
  return max;
}

function bestCategoryDefaults(tags: LandmarkInterestTag[]): InterestCategoryDefaults | null {
  let best: InterestCategoryDefaults | null = null;
  for (const tag of tags) {
    const defaults = INTEREST_CATEGORY_DEFAULTS[tag];
    if (!defaults) continue;
    if (!best || defaults.durationMax > best.durationMax) best = defaults;
  }
  return best;
}

/**
 * How long a stop should last: category min–max scaled by youngest child.
 * Indoor play 1.5–2h, water play 2–3h, shopping 1.5–3h (younger kids at the short end).
 */
export function visitDurationForTags(
  interestTags: LandmarkInterestTag[] | undefined,
  opts: { youngest?: number | null; title?: string } = {},
): number {
  const tags = [...(interestTags ?? [])];
  if (opts.title && WATER_PLAY_NAME.test(opts.title) && !tags.includes("beaches")) {
    tags.push("beaches");
  }
  const defaults = bestCategoryDefaults(tags);
  if (!defaults) return 90;
  return lerpDuration(
    defaults.durationMin,
    defaults.durationMax,
    durationBandFromYoungest(opts.youngest ?? null),
  );
}

function categoryEnergyFactor(landmark: Landmark): number {
  let max: "low" | "medium" | "high" = "medium";
  const rank = { low: 0, medium: 1, high: 2 };
  for (const tag of landmark.interestTags) {
    const defaults = INTEREST_CATEGORY_DEFAULTS[tag];
    if (!defaults) continue;
    if (rank[defaults.energyLevel] > rank[max]) max = defaults.energyLevel;
  }
  return ENERGY_FACTOR[max];
}

/**
 * Load units for one stop.
 * ~1.0 ≈ one hour at medium intensity (e.g. a short museum visit).
 * Travel before the stop adds a lighter cost so hops eat capacity.
 */
export function activityLoadUnits(
  landmark: Landmark,
  options: { travelMinBefore?: number; durationMin?: number } = {},
): number {
  const durationMin = options.durationMin ?? typicalDurationMinForLandmark(landmark);
  const intensity =
    INTENSITY_FACTOR[landmark.intensity] * categoryEnergyFactor(landmark);
  let load = (durationMin / 60) * intensity;
  // Major anchors (theme parks / high intensity) carry an extra commitment cost.
  if (
    landmark.intensity === "high" ||
    landmark.interestTags.includes("theme-parks") ||
    landmark.interestTags.includes("zoos")
  ) {
    load += 0.35;
  }
  const travelMin = options.travelMinBefore ?? 0;
  if (travelMin > 0) {
    load += (travelMin / 60) * 0.5;
  }
  return Math.round(load * 100) / 100;
}

export function sumActivityLoadUnits(
  landmarks: Landmark[],
  options: { travelMinsBetween?: number[] } = {},
): number {
  let total = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const travelMinBefore = options.travelMinsBetween?.[i] ?? 0;
    total += activityLoadUnits(landmarks[i]!, { travelMinBefore });
  }
  return Math.round(total * 100) / 100;
}

/**
 * Soft daily load budget by travel style × youngest-child band.
 * Naps with young kids shave ~15% — still allow two light stops on balanced.
 */
export function dailyLoadBudget(plan: TripPlan): number {
  const style: TravelStyle = plan.travelStyle || "balanced";
  const band = activityLoadAgeBand(plan);
  const table: Record<TravelStyle, Record<ActivityLoadAgeBand, number>> = {
    relaxed: { young: 2.0, school: 2.5, adult: 3.0 },
    balanced: { young: 3.5, school: 4.5, adult: 5.5 },
    packed: { young: 5.0, school: 6.5, adult: 7.5 },
  };
  let budget = table[style][band];
  const hasNap = (plan.naps?.length ?? 0) > 0;
  if (hasNap && band === "young") {
    budget *= 0.85;
  }
  return Math.round(budget * 100) / 100;
}

/** Whether adding `candidate` would exceed the day's load budget. */
export function fitsInDailyLoadBudget(
  alreadyToday: Landmark[],
  candidate: Landmark,
  plan: TripPlan,
  options: { travelMinBefore?: number } = {},
): boolean {
  const budget = dailyLoadBudget(plan);
  const current = sumActivityLoadUnits(alreadyToday);
  const next = activityLoadUnits(candidate, {
    travelMinBefore: options.travelMinBefore,
  });
  // Always allow the first stop of the day (anchor) even if it is a theme park.
  if (alreadyToday.length === 0) return true;
  return current + next <= budget + 0.05; // tiny float slack
}
