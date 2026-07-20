import { describe, expect, it } from "vitest";
import { groceryLocationNearRoute } from "@/lib/planning-engine/meal-timing";
import { resolveStayOntoPlan } from "@/lib/planning-engine/resolve-stay";
import {
  activityUsesStayHome,
  hasStayHome,
  stayHomeLocation,
} from "@/lib/planning-engine/stay-home";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    adults: 2,
    children: [3],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "airbnb_with_kitchen",
    stayAddress: "12 Rue Example, Paris",
    stayPlaceId: "place-1",
    stayLat: 48.86,
    stayLng: 2.34,
    dietaryRestrictions: "",
    napSchedule: "12-2 PM",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("stay-home — FAM-24", () => {
  it("detects a usable stay pin", () => {
    expect(hasStayHome(plan())).toBe(true);
    expect(hasStayHome(plan({ stayLat: null, stayLng: null }))).toBe(false);
    expect(hasStayHome(plan({ stayLat: undefined, stayLng: undefined }))).toBe(false);
  });

  it("builds a home location from stay fields", () => {
    expect(stayHomeLocation(plan())).toEqual({
      name: "12 Rue Example, Paris",
      lat: 48.86,
      lng: 2.34,
    });
  });

  it("marks naps, rest, cook-home, and host dinner as stay activities", () => {
    expect(activityUsesStayHome({ type: "nap", title: "Afternoon nap" })).toBe(true);
    expect(activityUsesStayHome({ type: "rest", title: "Quiet break" })).toBe(true);
    expect(activityUsesStayHome({ type: "meal", title: "Cook dinner at your rental" })).toBe(true);
    expect(activityUsesStayHome({ type: "meal", title: "Dinner with your hosts" })).toBe(true);
    expect(activityUsesStayHome({ type: "activity", title: "Louvre Museum" })).toBe(false);
    expect(activityUsesStayHome({ type: "meal", title: "Lunch near Louvre" })).toBe(false);
  });

  it("falls grocery back to stay when no prior stop has a location", () => {
    const home = stayHomeLocation(plan())!;
    const loc = groceryLocationNearRoute([{ location: undefined }], 0, {
      lat: 48.85,
      lng: 2.33,
      landmarks: [],
    } as never, home);
    expect(loc.name).toContain("12 Rue Example");
    expect(loc.lat).toBeCloseTo(48.864);
  });

  it("uses city center when stay is unknown", async () => {
    const resolved = await resolveStayOntoPlan(
      plan({
        accommodationType: "dont_know_yet",
        stayAddress: "",
        stayLat: null,
        stayLng: null,
      }),
    );
    expect(resolved.stayAddress).toContain("city center");
    expect(resolved.stayLat).toBeTypeOf("number");
    expect(resolved.stayLng).toBeTypeOf("number");
  });
});
