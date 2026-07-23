import { describe, expect, it } from "vitest";
import {
  CAR_CLUSTER_KM,
  clusterRadiusKm,
  PUBLIC_TRANSIT_CLUSTER_KM,
  TAXI_CLUSTER_KM,
  WALKING_CLUSTER_KM,
} from "@/config/cluster-distances";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    adults: 2,
    children: [5],
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

describe("cluster-distances config", () => {
  it("keeps mode radii in one adjustable place", () => {
    expect(WALKING_CLUSTER_KM).toBe(3);
    expect(PUBLIC_TRANSIT_CLUSTER_KM).toBe(5);
    expect(TAXI_CLUSTER_KM).toBe(9);
    expect(CAR_CLUSTER_KM).toBe(15);
  });

  it("maps transportation types to preferred radii", () => {
    expect(clusterRadiusKm(plan({ transportationType: "walking" }))).toBe(3);
    expect(clusterRadiusKm(plan({ transportationType: "public-transportation" }))).toBe(5);
    expect(clusterRadiusKm(plan({ transportationType: "taxis" }))).toBe(9);
    expect(clusterRadiusKm(plan({ transportationType: "car-rental" }))).toBe(15);
  });

  it("uses walking radius when walkingLimit is low", () => {
    expect(
      clusterRadiusKm(
        plan({ transportationType: "public-transportation", walkingLimit: "low" }),
      ),
    ).toBe(WALKING_CLUSTER_KM);
  });
});
