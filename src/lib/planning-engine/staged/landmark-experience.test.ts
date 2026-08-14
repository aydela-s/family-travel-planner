import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  dayActivityCategories,
  sharesDayActivityCategory,
} from "@/lib/planning-engine/staged/landmark-experience";

describe("dayActivityCategories", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("treats waterfront playground + beach as the same day category", () => {
    const waterfront = city.landmarks.find((l) => l.name === "Waterfront Park Playground")!;
    const beach = city.landmarks.find((l) => l.name === "Coronado Beach")!;

    expect(dayActivityCategories(waterfront).has("waterfront")).toBe(true);
    expect(dayActivityCategories(beach).has("beaches")).toBe(true);
    expect(sharesDayActivityCategory(waterfront, beach)).toBe(true);
  });
});
