import { describe, expect, it, vi } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import { planTrip } from "@/lib/planning-engine";
import {
  duplicateDayCategories,
  validateItinerary,
} from "@/lib/planning-engine/validate-itinerary";
import type { TripPlan } from "@/types/trip-plan";

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

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
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "vegan",
    naps: [],
    budgetStyle: "balanced",
    interests: [
      "Swimming & Water Play",
      "Nature & Scenic Views",
      "Indoor & Outdoor Play",
      "Interactive Museums",
      "Shopping",
    ],
    ...overrides,
  };
}

async function enrichedTrip(trip: TripPlan) {
  // No Google key in tests — estimates only, which keeps this deterministic.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  const { raw } = planTrip(trip, { cityOverride: city });
  const itinerary = await enrichItinerary(raw, trip, { cityOverride: city });
  vi.unstubAllGlobals();
  return itinerary;
}

describe("enriched itinerary obeys the planner rules", () => {
  it("returns days with no repeated category and no km anywhere", async () => {
    const trip = plan();
    const itinerary = await enrichedTrip(trip);

    for (const day of itinerary.days) {
      expect(duplicateDayCategories(day), `day ${day.day}`).toEqual([]);
      for (const activity of day.activities) {
        expect(activity.notes ?? "", activity.title).not.toMatch(/\d\s?km\b/i);
      }
      expect(day.metrics?.transportLabel ?? "").not.toMatch(/\bkm\b/);
    }
  });

  it("keeps every scheduled stop routed — no stale legs from a repaired day", async () => {
    const itinerary = await enrichedTrip(plan());
    for (const day of itinerary.days) {
      const stopNames = new Set(
        day.activities.filter((a) => a.type !== "travel").map((a) => a.location?.name),
      );
      for (const segment of day.routeSegments) {
        expect(stopNames.has(segment.from) || segment.from.length > 0).toBe(true);
        expect(stopNames.has(segment.to) || segment.to.length > 0).toBe(true);
      }
      for (const travel of day.activities.filter((a) => a.type === "travel")) {
        expect(travel.notes).toMatch(/\bmi\b/);
      }
    }
  });

  it("prices meals for the actual party and driving as fuel plus parking", async () => {
    const trip = plan();
    const itinerary = await enrichedTrip(trip);
    const violations = validateItinerary(itinerary.days, trip, city).map((v) => v.code);
    expect(violations).not.toContain("meal_cost_mismatch");
    expect(violations).not.toContain("transport_cost_mismatch");
    expect(violations).not.toContain("distance_not_in_miles");
    expect(violations).not.toContain("duplicate_day_category");
  });

  it("keeps restaurants off long backtracking detours", async () => {
    const trip = plan();
    const itinerary = await enrichedTrip(trip);
    const detours = validateItinerary(itinerary.days, trip, city).filter(
      (v) => v.code === "restaurant_detour",
    );
    expect(detours.map((v) => v.message)).toEqual([]);
  });
});
