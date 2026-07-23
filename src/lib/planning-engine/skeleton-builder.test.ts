import { describe, expect, it } from "vitest";
import { buildDayIntents } from "@/lib/planning-engine/skeleton-builder";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [5, 10],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function slotKinds(plan: TripPlan) {
  return buildDayIntents(plan, 1, 2).map((i) => i.kind);
}

describe("buildDayIntents — Phase 1 skeleton alignment", () => {
  it("starts breakfast at 08:00 when going out for breakfast", () => {
    const intents = buildDayIntents(basePlan({ accommodationType: "hotel_no_breakfast" }), 1, 2);
    expect(intents.find((i) => i.kind === "breakfast")?.defaultTime).toBe("08:00");
  });

  it("starts morning activity at 08:30 when breakfast is at accommodation", () => {
    const intents = buildDayIntents(
      basePlan({ accommodationType: "hotel_breakfast_included" }),
      1,
      2,
    );
    expect(intents.some((i) => i.kind === "breakfast")).toBe(false);
    expect(intents.find((i) => i.kind === "morning_activity")?.defaultTime).toBe("08:30");
  });

  it("balanced day includes a soft evening stroll before dinner", () => {
    const kinds = slotKinds(basePlan({ travelStyle: "balanced" }));
    expect(kinds).toContain("evening_rest");
    expect(kinds).toContain("afternoon_activity");
    expect(kinds).toContain("dinner");
  });

  it("packed day has three pre-dinner activities and no evening stroll", () => {
    const kinds = slotKinds(basePlan({ travelStyle: "packed" }));
    expect(kinds.filter((k) => k === "morning_activity" || k === "afternoon_activity" || k === "extra_activity")).toHaveLength(3);
    expect(kinds).not.toContain("evening_rest");
  });

  it("relaxed day has calm activity and a soft evening stroll", () => {
    const kinds = slotKinds(basePlan({ travelStyle: "relaxed" }));
    expect(kinds).toContain("calm_activity");
    expect(kinds).not.toContain("afternoon_rest");
    expect(kinds).not.toContain("afternoon_activity");
    expect(kinds).toContain("evening_rest");
  });
});
