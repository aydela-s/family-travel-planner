import { describe, expect, it } from "vitest";
import { createEmptyBlueprint, emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
import { TRIP_BLUEPRINT_VERSION } from "@/lib/planning-engine/staged/types";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [
      "Indoor & Outdoor Play",
      "Interactive Museums",
      "Beaches & Waterfronts",
      "Shows & Entertainment",
    ],
    ...overrides,
  };
}

describe("emptyPlanningRules — Budget/Pace as strategy seeds", () => {
  it("save prefers fewer paid days and picnic lunches", () => {
    const rules = emptyPlanningRules(plan({ budgetStyle: "save" }));
    expect(rules.paidDayRatio).toBeLessThan(0.35);
    expect(rules.preferPicnicLunch).toBe(true);
    expect(rules.namedRestaurantMeals).toEqual(["dinner"]);
    expect(rules.convenienceLevel).toBe("low");
  });

  it("splurge raises paid ratio and skips cook nights", () => {
    const rules = emptyPlanningRules(plan({ budgetStyle: "splurge" }));
    expect(rules.paidDayRatio).toBeGreaterThan(0.6);
    expect(rules.preferCookNights).toBe(false);
    expect(rules.namedRestaurantMeals).toContain("lunch");
    expect(rules.convenienceLevel).toBe("high");
  });

  it("packed pace allows more support stops than relaxed", () => {
    const packed = emptyPlanningRules(plan({ travelStyle: "packed" }));
    const relaxed = emptyPlanningRules(plan({ travelStyle: "relaxed" }));
    expect(packed.capacity.maxActivitiesPerDay).toBeGreaterThan(
      relaxed.capacity.maxActivitiesPerDay,
    );
    expect(packed.capacity.maxSupportStops).toBeGreaterThan(relaxed.capacity.maxSupportStops);
  });
});

describe("createEmptyBlueprint", () => {
  it("creates a versioned shell with one day slot per date", () => {
    const bp = createEmptyBlueprint(plan(), {
      dayCount: 3,
      transitMode: "car-rental",
      dates: ["2026-09-01", "2026-09-02", "2026-09-03"],
    });
    expect(bp.blueprintVersion).toBe(TRIP_BLUEPRINT_VERSION);
    expect(bp.days).toHaveLength(3);
    expect(bp.days[0]!.theme.label).toBe("Unset");
    expect(bp.experienceCoverage.items).toEqual([]);
    expect(bp.ledger.landmarkNames).toEqual([]);
  });
});
