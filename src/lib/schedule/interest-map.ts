import type { LandmarkInterestTag } from "@/config/city-pricing";

export type { LandmarkInterestTag };

/**
 * Wizard interest label → catalog interest key(s).
 * Category membership rules: docs/interest-categories.md
 */
export const INTEREST_LABEL_TO_TAGS: Record<string, LandmarkInterestTag[]> = {
  "Parks & Gardens": ["parks"],
  "Beaches & Waterfronts": ["beaches"],
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
