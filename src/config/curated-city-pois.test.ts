import { describe, expect, it } from "vitest";
import {
  CITY_CONFIGS,
  type LandmarkInterestTag,
} from "@/config/city-pricing";
import { CITY_RESTAURANTS } from "@/config/city-restaurants";

/** Core family interests curated cities should cover without Places fallback. */
const CORE_INTEREST_TAGS: LandmarkInterestTag[] = [
  "parks",
  "museums",
  "playgrounds",
  "interactive",
  "history",
  "nature",
];

const GOLD_STANDARD_CITY_IDS = ["san-diego", "london"] as const;

describe("curated city POI gold standard (FAM-62)", () => {
  for (const cityId of GOLD_STANDARD_CITY_IDS) {
    it(`${cityId} has a deep landmark pool with core interest coverage`, () => {
      const city = CITY_CONFIGS.find((c) => c.id === cityId);
      expect(city, `missing city ${cityId}`).toBeDefined();
      expect(city!.landmarks.length).toBeGreaterThanOrEqual(10);

      const tags = new Set(city!.landmarks.flatMap((l) => l.interestTags));
      for (const tag of CORE_INTEREST_TAGS) {
        expect(tags.has(tag), `${cityId} missing interest tag ${tag}`).toBe(true);
      }

      const hasLowIntensity = city!.landmarks.some((l) => l.intensity === "low");
      const hasIndoor = city!.landmarks.some((l) => l.indoor);
      const hasOutdoor = city!.landmarks.some((l) => !l.indoor);
      expect(hasLowIntensity).toBe(true);
      expect(hasIndoor).toBe(true);
      expect(hasOutdoor).toBe(true);

      const ages = new Set(city!.landmarks.flatMap((l) => l.ageTags));
      expect(ages.has("toddler")).toBe(true);
      expect(ages.has("child")).toBe(true);
    });

    it(`${cityId} has enough restaurants across breakfast, lunch, and dinner`, () => {
      const restaurants = CITY_RESTAURANTS[cityId] ?? [];
      expect(restaurants.length).toBeGreaterThanOrEqual(12);

      for (const meal of ["breakfast", "lunch", "dinner"] as const) {
        const count = restaurants.filter((r) => r.meals.includes(meal)).length;
        expect(count, `${cityId} thin on ${meal}`).toBeGreaterThanOrEqual(3);
      }

      const dietaryCovered = new Set(restaurants.flatMap((r) => r.dietary));
      expect(dietaryCovered.has("vegetarian")).toBe(true);
      expect(dietaryCovered.has("vegan")).toBe(true);
      expect(dietaryCovered.has("gluten-free")).toBe(true);
    });
  }

  it("every curated city keeps opening hours and intensity on landmarks", () => {
    for (const city of CITY_CONFIGS) {
      for (const landmark of city.landmarks) {
        expect(landmark.openingHours.open).toMatch(/^\d{2}:\d{2}$/);
        expect(landmark.openingHours.close).toMatch(/^\d{2}:\d{2}$/);
        expect(["low", "medium", "high"]).toContain(landmark.intensity);
        expect(landmark.interestTags.length).toBeGreaterThan(0);
        expect(landmark.ageTags.length).toBeGreaterThan(0);
      }
    }
  });
});
