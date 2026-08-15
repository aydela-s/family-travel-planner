import { describe, expect, it } from "vitest";
import { DEFAULT_CITY, CITY_CONFIGS } from "@/config/city-pricing";
import { calculateRideCost } from "@/lib/pricing/transport-cost";

describe("calculateRideCost", () => {
  it("prices a ~30 min US ride near $1/min all-in (not stacked high per-km)", () => {
    const { cost } = calculateRideCost(DEFAULT_CITY, 15, 30, 0);
    // ~$1/min mental model: expect roughly $25–$40 for a half-hour hop
    expect(cost).toBeGreaterThanOrEqual(25);
    expect(cost).toBeLessThanOrEqual(40);
  });

  it("keeps San Diego fares in the same ballpark", () => {
    const sd = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const { cost } = calculateRideCost(sd, 15, 30, 0);
    expect(cost).toBeGreaterThanOrEqual(25);
    expect(cost).toBeLessThanOrEqual(40);
  });
});
