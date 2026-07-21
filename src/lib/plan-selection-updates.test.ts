import { describe, expect, it } from "vitest";
import { updatesForPlanChip } from "@/lib/plan-selection-updates";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return { ...initialTripPlan, ...overrides };
}

describe("updatesForPlanChip (FAM-43)", () => {
  it("syncs walkingLimit when travel style changes", () => {
    expect(updatesForPlanChip("travelStyle", "relaxed", plan())).toEqual({
      travelStyle: "relaxed",
      walkingLimit: "low",
    });
    expect(updatesForPlanChip("travelStyle", "packed", plan())).toEqual({
      travelStyle: "packed",
      walkingLimit: "high",
    });
  });

  it("clears stay coordinates when switching to don’t know yet", () => {
    expect(
      updatesForPlanChip(
        "stay",
        "dont_know_yet",
        plan({
          stayAddress: "123 Main St",
          stayPlaceId: "abc",
          stayLat: 1,
          stayLng: 2,
        }),
      ),
    ).toEqual({
      accommodationType: "dont_know_yet",
      stayAddress: "",
      stayPlaceId: "",
      stayLat: null,
      stayLng: null,
    });
  });

  it("toggles dietary picks without wiping other selections", () => {
    const withVegan = plan({ dietaryRestrictions: "Vegetarian, Vegan" });
    expect(updatesForPlanChip("dietary", "Vegan", withVegan)).toEqual({
      dietaryRestrictions: "Vegetarian",
    });
    expect(updatesForPlanChip("dietary", "Gluten-free", withVegan)).toEqual({
      dietaryRestrictions: "Vegetarian, Vegan, Gluten-free",
    });
  });
});
