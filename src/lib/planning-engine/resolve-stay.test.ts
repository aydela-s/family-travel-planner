import { describe, expect, it } from "vitest";
import { DEFAULT_CITY } from "@/config/city-pricing";
import { resolveStayOntoPlan } from "./resolve-stay";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    ...initialTripPlan,
    destination: "Dallas, TX",
    destinationPlaceId: "places/dallas",
    destinationLat: 32.7767,
    destinationLng: -96.797,
    startDate: "2026-09-01",
    endDate: "2026-09-04",
    accommodationType: "dont_know_yet",
    transportationType: "taxis",
    travelStyle: "balanced",
    walkingLimit: "medium",
    budgetStyle: "balanced",
    interests: ["Zoos & Aquariums"],
    ...overrides,
  };
}

describe("resolveStayOntoPlan destination center (FAM-57)", () => {
  it("pins unknown Dallas stay to Texas, not DEFAULT_CITY New York", async () => {
    const resolved = await resolveStayOntoPlan(plan());
    expect(resolved.stayLat).toBeCloseTo(32.7767, 2);
    expect(resolved.stayLng).toBeCloseTo(-96.797, 2);
    expect(resolved.stayLat).not.toBeCloseTo(DEFAULT_CITY.lat, 1);
    expect(resolved.stayLng).not.toBeCloseTo(DEFAULT_CITY.lng, 1);
  });

  it("uses Places-resolved coords for cities not on the popular list", async () => {
    const resolved = await resolveStayOntoPlan(
      plan({
        destination: "Boise, ID, USA",
        destinationPlaceId: "ChIJx...",
        destinationLat: 43.615,
        destinationLng: -116.2023,
      }),
    );
    expect(resolved.stayLat).toBeCloseTo(43.615, 2);
    expect(resolved.stayLng).toBeCloseTo(-116.2023, 2);
  });
});
