import { describe, expect, it } from "vitest";
import { initialTripPlan } from "@/types/trip-plan";

describe("initialTripPlan — FAM-45", () => {
  it("defaults to 2 adults and 1 child aged 0", () => {
    expect(initialTripPlan.adults).toBe(2);
    expect(initialTripPlan.children).toEqual([0]);
  });
});
