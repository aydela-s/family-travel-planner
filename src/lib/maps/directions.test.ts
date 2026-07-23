import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  estimateDailyTransport,
  formatTransportDisplay,
} from "@/lib/maps/directions";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    adults: 2,
    children: [6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("formatTransportDisplay — FAM-38", () => {
  it("appends cost with a colon, without a Transport suffix", () => {
    expect(
      formatTransportDisplay(
        "public-transportation",
        "Public transit day pass × 4",
        32,
        "$",
      ),
    ).toBe("Public transit day pass × 4: $32.00");
  });

  it("uses Included / walking when transport cost is zero", () => {
    expect(
      formatTransportDisplay("walking", "8,500 steps · 6.2 km walking", 0, "$"),
    ).toBe("8,500 steps · 6.2 km walking: Included / walking");
  });
});

describe("estimateDailyTransport — FAM-42", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("rounds car fuel distance to a whole number of km and includes parking", () => {
    const result = estimateDailyTransport(
      "car-rental",
      city,
      plan(),
      [0, 0, 0],
      10.399999999999999,
    );
    expect(result.label).toBe("Car · fuel + parking (10 km, 3 stops)");
    expect(result.label).not.toMatch(/\d+\.\d+/);
    expect(result.distanceKm).toBe(10);
    expect(result.parkingCost).toBe(30);
    expect(result.cost).toBeGreaterThan(result.fuelCost ?? 0);
  });

  it("still shows fuel-only label when there are no stops to park at", () => {
    const result = estimateDailyTransport("car-rental", city, plan(), [], 0);
    expect(result.label).toBe("Car · est. fuel (0 km)");
    expect(result.parkingCost).toBe(0);
    expect(result.cost).toBe(0);
  });
});
