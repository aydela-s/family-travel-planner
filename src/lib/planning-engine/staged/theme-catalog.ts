import type { LandmarkInterestTag } from "@/config/city-pricing";
import type {
  DayBudgetIntent,
  DayConstraint,
  DayGoal,
  ThemeId,
} from "@/lib/planning-engine/staged/types";

export type ThemeDefinition = {
  id: ThemeId;
  /** Internal label only — not the user-facing day title. */
  label: string;
  /** Tags used for coverage + destination inventory. */
  coverageTags: LandmarkInterestTag[];
  preferredExperienceTypes: LandmarkInterestTag[];
  /** Typically requires a paid stop. */
  typicallyPaid: boolean;
  /** High intensity — may trigger recovery next day. */
  highIntensity: boolean;
  /** Interest-driven full-day themes (vs structural arrival/departure/recovery). */
  interestDriven: boolean;
};

/** Zoo POIs map into the animals theme; parks+nature into nature_parks. */
export const THEME_CATALOG: ThemeDefinition[] = [
  {
    id: "arrival",
    label: "Arrival",
    coverageTags: [],
    preferredExperienceTypes: ["parks", "playgrounds", "beaches", "nature"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: false,
  },
  {
    id: "departure",
    label: "Departure",
    coverageTags: [],
    preferredExperienceTypes: ["parks", "playgrounds", "beaches", "nature"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: false,
  },
  {
    id: "beach",
    label: "Beach",
    coverageTags: ["beaches"],
    preferredExperienceTypes: ["beaches", "nature", "sports"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "play_indoor",
    label: "Play indoor",
    coverageTags: ["indoor-play"],
    preferredExperienceTypes: ["indoor-play", "entertainment"],
    typicallyPaid: true,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "playgrounds",
    label: "Playgrounds",
    coverageTags: ["playgrounds"],
    preferredExperienceTypes: ["playgrounds", "parks"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "interactive",
    label: "Interactive",
    coverageTags: ["interactive"],
    preferredExperienceTypes: ["interactive"],
    typicallyPaid: true,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "animals",
    label: "Animals",
    coverageTags: ["zoos"],
    preferredExperienceTypes: ["zoos", "nature"],
    typicallyPaid: true,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "entertainment",
    label: "Entertainment",
    coverageTags: ["entertainment"],
    preferredExperienceTypes: ["entertainment", "theme-parks"],
    typicallyPaid: true,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "theme_park",
    label: "Theme park",
    coverageTags: ["theme-parks"],
    preferredExperienceTypes: ["theme-parks", "entertainment"],
    typicallyPaid: true,
    highIntensity: true,
    interestDriven: true,
  },
  {
    id: "nature",
    label: "Nature",
    coverageTags: ["nature"],
    preferredExperienceTypes: ["nature", "beaches"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "nature_parks",
    label: "Nature parks",
    coverageTags: ["parks", "nature"],
    preferredExperienceTypes: ["parks", "nature", "playgrounds"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "food_market",
    label: "Food market",
    coverageTags: ["food-markets"],
    preferredExperienceTypes: ["food-markets", "shopping"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "shopping",
    label: "Shopping",
    coverageTags: ["shopping"],
    preferredExperienceTypes: ["shopping"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "museums",
    label: "Museums",
    coverageTags: ["museums"],
    preferredExperienceTypes: ["museums", "history", "interactive"],
    typicallyPaid: true,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "history",
    label: "History",
    coverageTags: ["history"],
    preferredExperienceTypes: ["history", "museums"],
    typicallyPaid: true,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "scenic",
    label: "Scenic",
    coverageTags: ["nature", "beaches"],
    preferredExperienceTypes: ["nature", "beaches", "history"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: true,
  },
  {
    id: "mixed_family",
    label: "Mixed family",
    coverageTags: [],
    preferredExperienceTypes: ["interactive", "beaches", "entertainment", "nature"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: false,
  },
  {
    id: "recovery",
    label: "Recovery",
    coverageTags: [],
    preferredExperienceTypes: ["beaches", "nature", "parks", "playgrounds"],
    typicallyPaid: false,
    highIntensity: false,
    interestDriven: false,
  },
];

export function themeById(id: ThemeId): ThemeDefinition {
  const found = THEME_CATALOG.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown theme id: ${id}`);
  return found;
}

/** Goals + constraints attached when a theme is assigned to a full/recovery day. */
export function themeGoalsAndConstraints(
  theme: ThemeDefinition,
  opts: {
    hasNaps: boolean;
    isMixedAges: boolean;
    dayBudgetIntent: DayBudgetIntent;
  },
): { goals: DayGoal[]; constraints: DayConstraint[] } {
  const goals: DayGoal[] = [];
  const constraints: DayConstraint[] = [];

  if (opts.hasNaps) goals.push({ type: "honor_nap_windows" });

  const primary = theme.coverageTags[0];
  if (primary && theme.interestDriven) {
    goals.push({ type: "dedicated_experience", tag: primary });
    constraints.push({
      type: "anchor_primary_tags",
      tags: theme.coverageTags,
      mode: "any",
    });
  }

  if (theme.id === "beach") {
    constraints.push({ type: "discourage_indoor_paid_anchor" });
    constraints.push({ type: "prefer_shoreline_beach_anchor" });
    constraints.push({
      type: "discourage_anchor_tags",
      tags: ["museums", "interactive", "indoor-play", "parks"],
    });
  }

  if (theme.id === "play_indoor") {
    constraints.push({
      type: "discourage_anchor_tags",
      tags: ["history", "beaches", "theme-parks"],
    });
  }

  if (theme.id === "playgrounds") {
    constraints.push({ type: "prefer_free_anchor" });
    constraints.push({
      type: "discourage_anchor_tags",
      tags: ["indoor-play", "museums", "interactive"],
    });
  }

  if (theme.id === "interactive") {
    constraints.push({
      type: "discourage_anchor_tags",
      tags: ["beaches", "theme-parks", "history", "museums"],
    });
  }

  if (theme.id === "museums") {
    constraints.push({
      type: "discourage_anchor_tags",
      tags: ["shopping", "theme-parks", "beaches"],
    });
  }

  if (theme.id === "shopping") {
    // Morning low-key stop, then the mall as the main anchor (FAM-84).
    goals.push({ type: "keep_energy_low" });
    constraints.push({
      type: "discourage_anchor_tags",
      tags: ["museums", "interactive", "theme-parks"],
    });
  }

  if (theme.id === "theme_park") {
    // Low-key morning near stay, theme park as the long afternoon anchor (FAM-84).
    goals.push({ type: "half_day_anchor" });
    goals.push({ type: "keep_energy_low" });
    constraints.push({ type: "require_half_day_window" });
    constraints.push({ type: "prefer_paid_anchor" });
  }

  if (theme.id === "recovery" || theme.id === "nature" || theme.id === "nature_parks" || theme.id === "scenic") {
    goals.push({ type: "prefer_outdoor" });
    constraints.push({ type: "prefer_recovery_outdoor" });
  }

  if (theme.id === "mixed_family" && opts.isMixedAges) {
    goals.push({
      type: "include_older_appeal",
      options: ["scenic", "food", "cultural", "unique"],
    });
  }

  if (opts.dayBudgetIntent === "paid") {
    constraints.push({ type: "prefer_paid_anchor" });
  } else if (opts.dayBudgetIntent === "free") {
    constraints.push({ type: "prefer_free_anchor" });
  }

  return { goals, constraints };
}
