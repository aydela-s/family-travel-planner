import { describe, expect, it } from "vitest";
import { budgetStyleFoodFactor } from "@/lib/pricing/budget";

describe("budgetStyleFoodFactor", () => {
  it("keeps Save cheaper than Balanced and Splurge more expensive", () => {
    expect(budgetStyleFoodFactor("save")).toBeLessThan(budgetStyleFoodFactor("balanced"));
    expect(budgetStyleFoodFactor("balanced")).toBeLessThan(budgetStyleFoodFactor("splurge"));
  });
});
