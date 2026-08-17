import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { calculateRideCost } from "@/lib/pricing/transport-cost";
import {
  choosePublicTransitFare,
  estimateFuelCostForDriving,
  estimateParkingCost,
  estimateTaxiDailyCost,
  familyTransitRiders,
  injectTravelActivities,
} from "@/lib/pricing/transport-planner";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";
import type { ItineraryActivity, RouteSegment } from "@/types/itinerary";

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
    naps: [],
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

describe("injectTravelActivities", () => {
  const taxiPlan = plan({ transportationType: "taxis" });

  function hop(from: string, to: string, durationMin: number, cost: number): RouteSegment {
    return { from, to, distanceKm: 3, durationMin, cost };
  }

  it("starts the dinner taxi when the outing ends, not after an idle wait", () => {
    const activities: ItineraryActivity[] = [
      {
        time: "15:30",
        endTime: "17:00",
        title: "Family time at Kids Empire",
        type: "activity",
        timeOfDay: "afternoon",
        location: { name: "Kids Empire", lat: 1, lng: 1 },
      },
      {
        time: "18:00",
        endTime: "19:00",
        title: "Dinner at Vegan Food House",
        type: "meal",
        timeOfDay: "evening",
        location: { name: "Vegan Food House", lat: 2, lng: 2 },
      },
    ];
    const withTravel = injectTravelActivities(
      activities,
      [hop("Kids Empire", "Vegan Food House", 6, 9)],
      plan({ transportationType: "taxis", children: [4, 6] }),
    );
    const taxi = withTravel.find((a) => a.type === "travel")!;
    const dinner = withTravel.find((a) => a.type === "meal")!;
    expect(taxi.time).toBe("17:00");
    expect(taxi.endTime).toBe("17:15");
    expect(dinner.time).toBe("17:15");
    expect(taxi.title).toMatch(/Vegan Food House/i);
  });

  it("never emits a zero-duration taxi; lunch moves later if the ride overlaps", () => {
    const activities: ItineraryActivity[] = [
      {
        time: "10:00",
        endTime: "12:00",
        title: "Explore Science Museum",
        type: "activity",
        timeOfDay: "morning",
        location: { name: "Science Museum", lat: 1, lng: 1 },
      },
      {
        time: "12:00",
        endTime: "12:30",
        title: "Takeout or delivery lunch at your stay",
        type: "meal",
        timeOfDay: "afternoon",
        location: { name: "2334 Hardwick St", lat: 3, lng: 3 },
      },
    ];
    const withTravel = injectTravelActivities(
      activities,
      [hop("Science Museum", "2334 Hardwick St", 6, 9)],
      taxiPlan,
    );
    const taxi = withTravel.find((a) => a.type === "travel")!;
    const lunch = withTravel.find((a) => a.type === "meal")!;
    expect(taxi.time).toBe("12:00");
    expect(taxi.endTime).toBe("12:15");
    expect(parseTimeToMinutes(lunch.time)).toBeGreaterThanOrEqual(parseTimeToMinutes(taxi.endTime!));
  });

  it("does not insert a taxi from breakfast-near-X to the same attraction", () => {
    const activities: ItineraryActivity[] = [
      {
        time: "09:15",
        endTime: "10:00",
        title: "Breakfast near Science Museum",
        type: "meal",
        timeOfDay: "morning",
        location: { name: "Science Museum area", lat: 1, lng: 1 },
      },
      {
        time: "10:00",
        endTime: "12:00",
        title: "Explore Science Museum",
        type: "activity",
        timeOfDay: "morning",
        location: { name: "Science Museum", lat: 1, lng: 1 },
      },
    ];
    const withTravel = injectTravelActivities(
      activities,
      [hop("Science Museum area", "Science Museum", 5, 8)],
      taxiPlan,
    );
    expect(withTravel.filter((a) => a.type === "travel")).toHaveLength(0);
  });
});
