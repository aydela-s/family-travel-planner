import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { buildLandmarkContext } from "@/lib/planning-engine/slot-filler";
import {
  estimateTravelGapsForDay,
  estimateTravelMinBetween,
} from "@/lib/schedule/estimate-travel";
import {
  defaultTravelMin,
  YOUNG_CHILD_TRAVEL_BUFFER_MIN,
} from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [8, 12],
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

describe("young-child travel buffer — Phase 4", () => {
  it("adds buffer minutes when oldest child is 6 or under", () => {
    const withYoung = defaultTravelMin(basePlan({ children: [3, 5] }));
    const withOlder = defaultTravelMin(basePlan({ children: [8, 12] }));
    expect(withYoung).toBe(withOlder + YOUNG_CHILD_TRAVEL_BUFFER_MIN);
  });

  it("does not add buffer when oldest child is over 6", () => {
    expect(defaultTravelMin(basePlan({ children: [7] }))).toBe(20);
    expect(defaultTravelMin(basePlan({ children: [] }))).toBe(20);
  });

  it("still varies by transportation type with the young-child buffer", () => {
    const youngTaxi = defaultTravelMin(
      basePlan({ children: [4], transportationType: "taxis" }),
    );
    const youngTransit = defaultTravelMin(
      basePlan({ children: [4], transportationType: "public-transportation" }),
    );
    expect(youngTaxi).toBe(15 + YOUNG_CHILD_TRAVEL_BUFFER_MIN);
    expect(youngTransit).toBe(20 + YOUNG_CHILD_TRAVEL_BUFFER_MIN);
  });
});

describe("haversine travel estimates — Phase 4", () => {
  const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("estimates longer travel for distant landmarks than nearby ones", () => {
    const plan = basePlan();
    const balboa = sanDiego.landmarks.find((l) => l.name === "Balboa Park")!;
    const zoo = sanDiego.landmarks.find((l) => l.name === "San Diego Zoo")!;
    const laJolla = sanDiego.landmarks.find((l) => l.name === "La Jolla Cove")!;

    const near = estimateTravelMinBetween(balboa, zoo, plan);
    const far = estimateTravelMinBetween(balboa, laJolla, plan);
    expect(far).toBeGreaterThan(near);
    expect(near).toBeGreaterThanOrEqual(defaultTravelMin(plan));
  });

  it("builds per-leg gaps from day landmark context", () => {
    const plan = basePlan({ children: [10] });
    const ctx = buildLandmarkContext(sanDiego, plan, 1, 2);
    const activities = [
      { title: "Morning", type: "activity", slotKind: "morning_activity" as const },
      { title: "Lunch", type: "meal", slotKind: "lunch" as const },
      { title: "Afternoon", type: "activity", slotKind: "afternoon_activity" as const },
    ];
    const gaps = estimateTravelGapsForDay(activities, ctx, plan);
    expect(gaps).toHaveLength(2);
    expect(gaps.every((g) => g >= defaultTravelMin(plan))).toBe(true);
  });

  it("young-child buffer floors distance-based estimates", () => {
    const plan = basePlan({ children: [4] });
    const balboa = sanDiego.landmarks.find((l) => l.name === "Balboa Park")!;
    const zoo = sanDiego.landmarks.find((l) => l.name === "San Diego Zoo")!;
    const estimate = estimateTravelMinBetween(balboa, zoo, plan);
    expect(estimate).toBeGreaterThanOrEqual(defaultTravelMin(plan));
  });
});
