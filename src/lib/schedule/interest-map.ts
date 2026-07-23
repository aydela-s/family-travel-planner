import type { LandmarkInterestTag } from "@/config/city-pricing";

export type { LandmarkInterestTag };

/** Wizard interest label → catalog interest key(s). */
export const INTEREST_LABEL_TO_TAGS: Record<string, LandmarkInterestTag[]> = {
  "Parks & Gardens": ["parks"],
  "Beaches & Waterfronts": ["beaches"],
  "Nature & Scenic Views": ["nature", "parks"],
  "History & Landmarks": ["history"],
  "Museums & Art": ["museums"],
  Playgrounds: ["playgrounds", "parks"],
  "Zoos & Aquariums": ["zoos"],
  "Theme Parks": ["theme-parks"],
  "Interactive Museums": ["interactive", "museums"],
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
