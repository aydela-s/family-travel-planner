import type { LandmarkInterestTag } from "@/config/city-pricing";

export type { LandmarkInterestTag };

/**
 * Legacy wizard labels still stored on shared / saved trips.
 * Keep mapped so those plans keep planning; display via normalizeInterestLabels.
 */
export const LEGACY_INTEREST_LABEL_TO_CANONICAL: Record<string, string> = {
  "Beaches & Waterfronts": "Swimming & Water Play",
  "Playgrounds & Indoor Play": "Indoor & Outdoor Play",
  Playgrounds: "Indoor & Outdoor Play",
};

/** Rewrite stored/legacy labels to the current wizard names (deduped, order preserved). */
export function normalizeInterestLabels(interests: string[]): string[] {
  const out: string[] = [];
  for (const label of interests) {
    const canonical = LEGACY_INTEREST_LABEL_TO_CANONICAL[label] ?? label;
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

/**
 * Wizard interest label → catalog interest key(s).
 * Category membership rules: docs/interest-categories.md
 */
export const INTEREST_LABEL_TO_TAGS: Record<string, LandmarkInterestTag[]> = {
  "Parks & Gardens": ["parks"],
  "Beaches & Waterfronts": ["beaches"],
  // Inland pools / aquatic centers / indoor water parks (same coverage as beaches).
  "Swimming & Water Play": ["beaches"],
  // Nature excludes manicured parks/gardens (see interest-categories.md).
  "Nature & Scenic Views": ["nature"],
  "History & Landmarks": ["history"],
  "Museums & Art": ["museums"],
  // Outdoor playgrounds + indoor soft play / bounce houses (parks alias omitted on purpose).
  Playgrounds: ["playgrounds", "indoor-play"],
  "Indoor & Outdoor Play": ["playgrounds", "indoor-play"],
  "Playgrounds & Indoor Play": ["playgrounds", "indoor-play"],
  "Zoos & Aquariums": ["zoos"],
  "Animal Experiences": ["animal-experiences"],
  "Theme Parks": ["theme-parks"],
  // Hands-on only — do not alias to look-don't-touch art/history museums (see interest-categories.md).
  "Interactive Museums": ["interactive"],
  "Tours & Sightseeing": ["tours"],
  "Food Markets": ["food-markets"],
  Shopping: ["shopping"],
  "Shows & Entertainment": ["entertainment"],
  "Sports & Recreation": ["sports"],
  Spas: ["spas"],
};

export function interestTagsFromPlan(interests: string[]): LandmarkInterestTag[] {
  const tags = new Set<LandmarkInterestTag>();
  for (const label of interests) {
    for (const tag of INTEREST_LABEL_TO_TAGS[label] ?? []) {
      tags.add(tag);
    }
  }
  return [...tags];
}

/** First tag for each wizard label — weighted higher than secondary aliases. */
export function primaryInterestTagsFromPlan(interests: string[]): Set<LandmarkInterestTag> {
  const tags = new Set<LandmarkInterestTag>();
  for (const label of interests) {
    const primary = INTEREST_LABEL_TO_TAGS[label]?.[0];
    if (primary) tags.add(primary);
  }
  return tags;
}

const TAG_FALLBACK_LABEL: Partial<Record<LandmarkInterestTag, string>> = {
  parks: "Parks & Gardens",
  beaches: "Swimming & Water Play",
  nature: "Nature & Scenic Views",
  history: "History & Landmarks",
  museums: "Museums & Art",
  playgrounds: "Indoor & Outdoor Play",
  "indoor-play": "Indoor & Outdoor Play",
  zoos: "Zoos & Aquariums",
  "animal-experiences": "Animal Experiences",
  "theme-parks": "Theme Parks",
  interactive: "Interactive Museums",
  tours: "Tours & Sightseeing",
  "food-markets": "Food Markets",
  shopping: "Shopping",
  entertainment: "Shows & Entertainment",
  sports: "Sports & Recreation",
  spas: "Spas",
};

/**
 * Map activity interest tags back to wizard labels (preferring the user's selection order).
 * Tags that don't match any selected interest are labeled so soft-fill parks are visible.
 */
export function interestSourceLabels(
  tags: LandmarkInterestTag[] | undefined,
  planInterests: string[] = [],
): string[] {
  if (!tags?.length) return [];
  const selected = normalizeInterestLabels(planInterests);
  const matched: string[] = [];
  for (const label of selected) {
    const labelTags = INTEREST_LABEL_TO_TAGS[label] ?? [];
    if (labelTags.some((t) => tags.includes(t))) {
      matched.push(label);
    }
  }
  if (matched.length > 0) return matched;

  const fallback: string[] = [];
  for (const tag of tags) {
    const label = TAG_FALLBACK_LABEL[tag] ?? tag;
    if (!fallback.includes(label)) fallback.push(label);
  }
  return fallback.map((label) =>
    selected.length > 0 && !selected.includes(label)
      ? `${label} (not in your interests)`
      : label,
  );
}
