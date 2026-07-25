import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  familyActivityCost,
  ticketPriceForAge,
} from "@/lib/pricing/activity-cost";

describe("age-band ticket pricing", () => {
  const zoo = CITY_CONFIGS.find((c) => c.id === "san-diego")!.landmarks.find(
    (l) => l.name === "San Diego Zoo",
  )!;

  it("uses curated tiers for toddler / child / adult", () => {
    expect(ticketPriceForAge(zoo.ticketTiers, zoo.adultPrice, 2)).toBe(0);
    expect(ticketPriceForAge(zoo.ticketTiers, zoo.adultPrice, 8)).toBe(62);
    expect(ticketPriceForAge(zoo.ticketTiers, zoo.adultPrice, "adult")).toBe(72);
    expect(ticketPriceForAge(zoo.ticketTiers, zoo.adultPrice, 15)).toBe(72);
  });

  it("sums a family ticket total from tiers", () => {
    // 2 adults + ages 2 and 8
    expect(familyActivityCost(zoo, 2, [2, 8])).toBe(2 * 72 + 0 + 62);
  });

  it("falls back to multipliers when tiers are missing", () => {
    expect(familyActivityCost(40, 2, [2, 8])).toBe(2 * 40 + 0 + 40 * 0.7);
  });
});
