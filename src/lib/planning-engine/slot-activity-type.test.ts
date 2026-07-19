import { describe, expect, it } from "vitest";
import { slotActivityType } from "@/lib/planning-engine/meal-planner";

describe("slotActivityType — FAM-14", () => {
  it("maps strolls and free-time slots to activity, not rest", () => {
    expect(slotActivityType("evening_rest")).toBe("activity");
    expect(slotActivityType("afternoon_rest")).toBe("activity");
    expect(slotActivityType("midday_rest")).toBe("activity");
    expect(slotActivityType("calm_activity")).toBe("activity");
  });

  it("keeps meals as meal", () => {
    expect(slotActivityType("breakfast")).toBe("meal");
    expect(slotActivityType("lunch")).toBe("meal");
    expect(slotActivityType("dinner")).toBe("meal");
  });
});
