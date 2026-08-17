import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  allocateRouteSegmentCosts,
  estimateDrivingLegCost,
  estimateFuelCostForDriving,
  FUEL_CONSUMPTION_L_PER_100KM,
  injectTravelActivities,
} from "@/lib/pricing/transport-planner";
import type { ItineraryActivity, RouteSegment } from "@/types/itinerary";
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
    stayAddress: "1234 Harbor Dr",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function segment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: "Balboa Park",
    to: "La Jolla Cove",
    distanceKm: 8.4,
    durationMin: 14,
    cost: 0,
    ...overrides,
  };
}

describe("driving cost — fuel and parking, never one unexplained number", () => {
  it("prices fuel from the actual distance and the city's fuel price", () => {
    const liters = (8.4 / 100) * FUEL_CONSUMPTION_L_PER_100KM;
    expect(estimateFuelCostForDriving(city, 8.4)).toBeCloseTo(
      Math.round(city.transport.fuelPricePerLiter * liters * 100) / 100,
      2,
    );
    expect(estimateFuelCostForDriving(city, 0)).toBe(0);
  });

  it("scales fuel linearly with distance", () => {
    const short = estimateFuelCostForDriving(city, 10);
    const long = estimateFuelCostForDriving(city, 20);
    expect(long).toBeCloseTo(short * 2, 1);
  });

  it("splits a leg into fuel plus parking that add up to the total", () => {
    const leg = estimateDrivingLegCost(city, 8.4);
    expect(leg.fuel).toBeGreaterThan(0);
    expect(leg.parking).toBe(city.transport.parkingFeePerStop);
    expect(leg.total).toBeCloseTo(leg.fuel + leg.parking, 2);
  });

  it("charges no parking when the leg ends at the family's own stay", () => {
    const [toStay] = allocateRouteSegmentCosts(
      [segment({ to: "1234 Harbor Dr" })],
      plan(),
      city,
    );
    expect(toStay!.parkingCost).toBe(0);
    expect(toStay!.cost).toBeCloseTo(toStay!.fuelCost ?? 0, 2);
  });

  it("charges parking once per stop that is not the stay", () => {
    const [toCove] = allocateRouteSegmentCosts([segment()], plan(), city);
    expect(toCove!.parkingCost).toBe(city.transport.parkingFeePerStop);
    expect(toCove!.cost).toBeCloseTo((toCove!.fuelCost ?? 0) + (toCove!.parkingCost ?? 0), 2);
  });

  it("shows distance and driving time on the travel step (cost is on the badge)", () => {
    const stops: ItineraryActivity[] = [
      {
        time: "10:00",
        endTime: "11:30",
        title: "Explore Balboa Park",
        type: "activity",
        location: { name: "Balboa Park", lat: 32.73, lng: -117.15 },
      },
      {
        time: "12:30",
        endTime: "13:30",
        title: "Lunch at Kono's Cafe",
        type: "meal",
        location: { name: "La Jolla Cove", lat: 32.85, lng: -117.27 },
      },
    ];
    const priced = allocateRouteSegmentCosts([segment()], plan(), city);
    const withTravel = injectTravelActivities(stops, priced, plan(), city.currencySymbol);
    const travel = withTravel.find((a) => a.type === "travel")!;

    expect(travel.notes).toContain("5.2 mi");
    expect(travel.notes).toContain("~14 min driving");
    expect(travel.notes).not.toMatch(/\bkm\b/);
    expect(travel.notes).not.toContain("fuel");
    expect(travel.notes).not.toContain("parking");
    expect(travel.activityCost).toBeGreaterThan(0);
  });
});
