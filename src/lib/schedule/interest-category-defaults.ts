import type { LandmarkInterestTag } from "@/config/city-pricing";
import { PACKED_LONGER_ACTIVITY_MIN } from "@/lib/schedule/travel-style";

/**
 * Category-level defaults from docs/interest-categories.md.
 * Per-activity overrides (landmark catalog) win when present later.
 */
export type InterestCategoryDefaults = {
  /** Canonical id from the interest-categories doc. */
  id: string;
  durationMin: number;
  durationMax: number;
  energyLevel: "low" | "medium" | "high";
  weatherDependent: boolean | "mixed";
  indoorOutdoor: "indoor" | "outdoor" | "both";
};

/** Catalog tag → category defaults (see docs/interest-categories.md). */
export const INTEREST_CATEGORY_DEFAULTS: Record<
  LandmarkInterestTag,
  InterestCategoryDefaults
> = {
  parks: {
    id: "parks_gardens",
    durationMin: 60,
    durationMax: 90,
    energyLevel: "low",
    weatherDependent: true,
    indoorOutdoor: "outdoor",
  },
  beaches: {
    id: "swimming_water_play",
    durationMin: 120,
    durationMax: 180,
    energyLevel: "medium",
    weatherDependent: true,
    indoorOutdoor: "outdoor",
  },
  nature: {
    id: "nature_scenic",
    durationMin: 90,
    durationMax: 150,
    energyLevel: "medium",
    weatherDependent: true,
    indoorOutdoor: "outdoor",
  },
  history: {
    id: "history_landmarks",
    durationMin: 60,
    durationMax: 90,
    energyLevel: "medium",
    weatherDependent: false,
    indoorOutdoor: "both",
  },
  museums: {
    id: "museums_art",
    durationMin: 60,
    durationMax: 120,
    energyLevel: "low",
    weatherDependent: false,
    indoorOutdoor: "indoor",
  },
  playgrounds: {
    id: "indoor_outdoor_play",
    durationMin: 45,
    durationMax: 90,
    energyLevel: "high",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  "indoor-play": {
    id: "indoor_outdoor_play",
    durationMin: 90,
    durationMax: 120,
    energyLevel: "high",
    weatherDependent: false,
    indoorOutdoor: "indoor",
  },
  zoos: {
    id: "zoos_aquariums",
    durationMin: 120,
    durationMax: 180,
    energyLevel: "medium",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  "animal-experiences": {
    id: "animal_experiences",
    durationMin: 60,
    durationMax: 120,
    energyLevel: "medium",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  "theme-parks": {
    id: "theme_parks",
    durationMin: 240,
    durationMax: 480,
    energyLevel: "high",
    weatherDependent: true,
    indoorOutdoor: "outdoor",
  },
  interactive: {
    id: "interactive_museums",
    durationMin: 90,
    durationMax: 150,
    energyLevel: "medium",
    weatherDependent: false,
    indoorOutdoor: "indoor",
  },
  tours: {
    id: "tours_sightseeing",
    durationMin: 90,
    durationMax: 180,
    energyLevel: "medium",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  "food-markets": {
    id: "food_markets",
    durationMin: 45,
    durationMax: 75,
    energyLevel: "medium",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  shopping: {
    id: "shopping",
    durationMin: 90,
    durationMax: 180,
    energyLevel: "low",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  entertainment: {
    id: "shows_entertainment",
    durationMin: 60,
    durationMax: 120,
    energyLevel: "low",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  sports: {
    id: "sports_recreation",
    durationMin: 60,
    durationMax: 120,
    energyLevel: "high",
    weatherDependent: "mixed",
    indoorOutdoor: "both",
  },
  spas: {
    id: "spas",
    durationMin: 60,
    durationMax: 120,
    energyLevel: "low",
    weatherDependent: false,
    indoorOutdoor: "indoor",
  },
};

/**
 * Target duration for a packed "fewer / longer" adventure.
 * Short categories use their doc upper bound (e.g. playgrounds 90).
 * Longer categories (nature/beaches/zoos) stretch to PACKED_LONGER_ACTIVITY_MIN
 * on multi-stop days so naps/meals still fit; theme parks use half-day min.
 */
export function packedLongerDurationForTags(
  interestTags: LandmarkInterestTag[] | undefined,
): number {
  if (!interestTags || interestTags.length === 0) {
    return PACKED_LONGER_ACTIVITY_MIN;
  }
  let max = 0;
  let hasThemePark = false;
  for (const tag of interestTags) {
    const defaults = INTEREST_CATEGORY_DEFAULTS[tag];
    if (!defaults) continue;
    if (tag === "theme-parks") hasThemePark = true;
    max = Math.max(max, defaults.durationMax);
  }
  if (max === 0) return PACKED_LONGER_ACTIVITY_MIN;
  // Theme parks are half-day+ commitments — use the category minimum.
  if (hasThemePark) return INTEREST_CATEGORY_DEFAULTS["theme-parks"].durationMin;
  if (max <= PACKED_LONGER_ACTIVITY_MIN) return max;
  return PACKED_LONGER_ACTIVITY_MIN;
}
