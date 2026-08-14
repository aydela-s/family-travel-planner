import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  assignDayRoles,
  buildTripStrategy,
  goalsAndConstraintsForRole,
} from "@/lib/planning-engine/staged/strategy-builder";
import { emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
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
      "Playgrounds & Indoor Play",
      "Interactive Museums",
      "Beaches & Waterfronts",
      "Shows & Entertainment",
    ],
    ...overrides,
  };
}

describe("assignDayRoles", () => {
  it("marks first/last as arrival/departure on 5-day trips", () => {
    expect(assignDayRoles(5)).toEqual([
      "arrival",
      "full",
      "full",
      "full",
      "departure",
    ]);
  });

  it("uses arrival+departure for 2-day trips", () => {
    expect(assignDayRoles(2)).toEqual(["arrival", "departure"]);
  });
});

describe("goalsAndConstraintsForRole", () => {
  const rules = emptyPlanningRules(plan());

  it("arrival is low-friction with soft outdoor/near-stay preference", () => {
    const { goals, constraints } = goalsAndConstraintsForRole("arrival", rules);
    expect(goals.some((g) => g.type === "low_friction")).toBe(true);
    expect(goals.some((g) => g.type === "prefer_near_stay_or_flexible_outdoor")).toBe(true);
    expect(constraints.some((c) => c.type === "avoid_high_risk_time_sensitive_anchor")).toBe(
      true,
    );
    expect(
      constraints.some(
        (c) => c.type === "discourage_anchor_tags" && c.tags.includes("theme-parks"),
      ),
    ).toBe(true);
  });
});

describe("buildTripStrategy", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("seeds ExperienceCoverage from selected interests", () => {
    const bp = buildTripStrategy(plan(), { city });
    const keys = bp.experienceCoverage.items.map((i) => i.key).sort();
    expect(keys).toEqual(
      ["beaches", "entertainment", "indoor-play", "interactive", "playgrounds"].sort(),
    );
    expect(bp.experienceCoverage.items.every((i) => i.target >= 1)).toBe(true);
    expect(bp.experienceCoverage.items.every((i) => i.completed === 0)).toBe(true);
  });

  it("assigns arrival goals on day 1 and departure on last day", () => {
    const bp = buildTripStrategy(plan(), { city });
    expect(bp.days).toHaveLength(5);
    expect(bp.days[0]!.role).toBe("arrival");
    expect(bp.days[0]!.goals.some((g) => g.type === "low_friction")).toBe(true);
    expect(bp.days[4]!.role).toBe("departure");
    expect(bp.days[1]!.theme.label).toBe("Pending theme");
  });

  it("compiles budget/pace into rules consumed by later stages", () => {
    const bp = buildTripStrategy(plan({ budgetStyle: "save", travelStyle: "packed" }), {
      city,
    });
    expect(bp.rules.budgetStyle).toBe("save");
    expect(bp.rules.preferPicnicLunch).toBe(true);
    expect(bp.rules.capacity.maxActivitiesPerDay).toBe(3);
  });
});
