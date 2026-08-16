import type { LandmarkInterestTag } from "@/config/city-pricing";

export type { LandmarkInterestTag };

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
  "Playgrounds & Indoor Play": ["playgrounds", "indoor-play"],
  "Zoos & Aquariums": ["zoos"],
  "Theme Parks": ["theme-parks"],
  // Hands-on only — do not alias to look-don't-touch art/history museums (see interest-categories.md).
  "Interactive Museums": ["interactive"],
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
  beaches: "Swimming / Beaches",
  nature: "Nature & Scenic Views",
  history: "History & Landmarks",
  museums: "Museums & Art",
  playgrounds: "Playgrounds",
  "indoor-play": "Indoor Play",
  zoos: "Zoos & Aquariums",
  "theme-parks": "Theme Parks",
  interactive: "Interactive Museums",
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
  const matched: string[] = [];
  for (const label of planInterests) {
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
    planInterests.length > 0 && !planInterests.includes(label)
      ? `${label} (not in your interests)`
      : label,
  );
}
