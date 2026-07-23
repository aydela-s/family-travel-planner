import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { calculateRideCost } from "@/lib/pricing/transport-cost";
import {
  choosePublicTransitFare,
  estimateFuelCostForDriving,
  estimateParkingCost,
  estimateTaxiDailyCost,
  familyTransitRiders,
} from "@/lib/pricing/transport-planner";
import { TripPlan } from "@/types/trip-plan";

const SAN_DIEGO = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    adults: 2,
    children: [6, 10],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("transport business rules", () => {
  describe("car rental — fuel cost scales with driven distance", () => {
    it("returns zero when there is no driving", () => {
      expect(estimateFuelCostForDriving(SAN_DIEGO, 0)).toBe(0);
    });

    it("doubles fuel cost when driven distance doubles", () => {
      const shortTrip = estimateFuelCostForDriving(SAN_DIEGO, 20);
      const longTrip = estimateFuelCostForDriving(SAN_DIEGO, 40);
      expect(longTrip).toBe(shortTrip * 2);
    });

    it("no longer uses the flat avgFuelLitersPerDay regardless of distance", () => {
      const flatDaily =
        SAN_DIEGO.transport.fuelPricePerLiter * SAN_DIEGO.transport.avgFuelLitersPerDay;
      const shortDay = estimateFuelCostForDriving(SAN_DIEGO, 10);
      expect(shortDay).toBeLessThan(flatDaily);
    });
  });

  describe("car rental — parking fees per stop", () => {
    it("charges parkingFeePerStop for each destination stop", () => {
      expect(estimateParkingCost(SAN_DIEGO, 0)).toBe(0);
      expect(estimateParkingCost(SAN_DIEGO, 1)).toBe(SAN_DIEGO.transport.parkingFeePerStop);
      expect(estimateParkingCost(SAN_DIEGO, 3)).toBe(SAN_DIEGO.transport.parkingFeePerStop * 3);
    });
  });

  describe("public transit — cheaper of day pass vs individual tickets for the whole family", () => {
    it("counts every traveler in the family", () => {
      expect(familyTransitRiders(plan())).toBe(4);
      expect(familyTransitRiders(plan({ adults: 2, children: [] }))).toBe(2);
    });

    it("chooses day pass when it is cheaper for the family", () => {
      // 4 riders × $6 day pass = $24 vs 4 riders × 1 ride × $2.50 = $10 — individual wins with 1 ride
      const oneRide = choosePublicTransitFare(SAN_DIEGO, plan(), 1);
      expect(oneRide.method).toBe("individual");
      expect(oneRide.cost).toBe(10);

      // 4 riders × 3 rides × $2.50 = $30 vs $24 day pass — day pass wins
      const threeRides = choosePublicTransitFare(SAN_DIEGO, plan(), 3);
      expect(threeRides.method).toBe("day-pass");
      expect(threeRides.cost).toBe(24);
    });

    it("treats a day with no route segments as at least one ride", () => {
      const choice = choosePublicTransitFare(SAN_DIEGO, plan(), 0);
      expect(choice.cost).toBe(10);
    });
  });

  describe("taxi — total estimated cost sums segment fares", () => {
    it("adds up each ride segment for the day", () => {
      const segmentA = calculateRideCost(SAN_DIEGO, 5, 15, 0).cost;
      const segmentB = calculateRideCost(SAN_DIEGO, 3, 10, 1).cost;
      expect(estimateTaxiDailyCost([segmentA, segmentB])).toBe(
        Math.round((segmentA + segmentB) * 100) / 100,
      );
    });
  });
});
