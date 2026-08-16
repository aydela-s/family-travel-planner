import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  applyMealActivityCosts,
  estimateMealCostForActivity,
  estimateMealCosts,
  summarizeDailyCost,
} from "@/lib/pricing/budget";
import {
  allocateRouteSegmentCosts,
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
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("per-meal food costs", () => {
  it("attaches a positive cost to each meal that sums to the day food total", () => {
    const activities: ItineraryActivity[] = [
      {
        time: "08:00",
        title: "Breakfast near Balboa Park",
        type: "meal",
        timeOfDay: "morning",
      },
      {
        time: "12:30",
        title: "Lunch at Puesto",
        type: "meal",
        timeOfDay: "afternoon",
      },
      {
        time: "18:00",
        title: "Dinner at Cucina Urbana",
        type: "meal",
        timeOfDay: "evening",
      },
      {
        time: "10:00",
        title: "Explore Balboa Park",
        type: "activity",
        timeOfDay: "morning",
        activityCost: 40,
      },
    ];

    const priced = applyMealActivityCosts(activities, city, plan());
    const meals = priced.filter((a) => a.type === "meal");
    expect(meals.every((m) => typeof m.activityCost === "number")).toBe(true);
    expect(meals.some((m) => (m.activityCost ?? 0) > 0)).toBe(true);

    const foodSum = meals.reduce((s, m) => s + (m.activityCost ?? 0), 0);
    expect(foodSum).toBeCloseTo(estimateMealCosts(priced, city, plan()), 2);

    const summary = summarizeDailyCost(priced, 25, city, plan());
    expect(summary.food).toBeCloseTo(foodSum, 2);
    // Attraction cost stays in activities — meal costs do not double-count.
    expect(summary.activities).toBe(40);
  });

  it("prices takeout lunch cheaper than a named restaurant lunch", () => {
    const takeout = estimateMealCostForActivity(
      {
        time: "12:30",
        title: "Takeout or delivery lunch at your stay",
        type: "meal",
        timeOfDay: "afternoon",
      },
      city,
      plan(),
    );
    const restaurant = estimateMealCostForActivity(
      {
        time: "12:30",
        title: "Lunch at Puesto",
        type: "meal",
        timeOfDay: "afternoon",
      },
      city,
      plan(),
    );
    expect(takeout).toBeLessThan(restaurant);
  });
});

describe("per-route transport costs", () => {
  const segments: RouteSegment[] = [
    { from: "Hotel", to: "Zoo", distanceKm: 10, durationMin: 20, cost: 0 },
    { from: "Zoo", to: "Park", distanceKm: 10, durationMin: 18, cost: 0 },
  ];

  it("allocates car fuel + parking onto each driving leg", () => {
    const priced = allocateRouteSegmentCosts(segments, plan({ transportationType: "car-rental" }), city);
    expect(priced.every((s) => s.cost > 0)).toBe(true);
    expect(priced[0]!.cost).toBeCloseTo(priced[1]!.cost, 1);
  });

  it("injects travel timeline rows with those leg costs", () => {
    const priced = allocateRouteSegmentCosts(segments, plan({ transportationType: "car-rental" }), city);
    const activities: ItineraryActivity[] = [
      {
        time: "09:00",
        endTime: "09:30",
        title: "Breakfast near Hotel",
        type: "meal",
        timeOfDay: "morning",
        location: { name: "Hotel", lat: 1, lng: 1 },
      },
      {
        time: "10:00",
        endTime: "12:00",
        title: "Explore Zoo",
        type: "activity",
        timeOfDay: "morning",
        location: { name: "Zoo", lat: 2, lng: 2 },
        activityCost: 50,
      },
      {
        time: "14:00",
        endTime: "16:00",
        title: "Explore Park",
        type: "activity",
        timeOfDay: "afternoon",
        location: { name: "Park", lat: 3, lng: 3 },
      },
    ];

    const withTravel = injectTravelActivities(activities, priced, plan({ transportationType: "car-rental" }));
    const legs = withTravel.filter((a) => a.type === "travel");
    expect(legs).toHaveLength(2);
    expect(legs[0]!.title).toMatch(/Drive to Zoo/i);
    expect(legs[0]!.activityCost).toBe(priced[0]!.cost);
    expect(legs[1]!.title).toMatch(/Drive to Park/i);
    expect(legs[1]!.activityCost).toBe(priced[1]!.cost);

    const summary = summarizeDailyCost(withTravel, 33, city, plan());
    // Travel costs must not inflate the Activities bucket.
    expect(summary.activities).toBe(50);
    expect(summary.transport).toBe(33);
  });

  it("puts the public-transit day pass on the first billable leg only when a day pass wins", () => {
    // Enough rides that a day pass beats individual tickets for this family.
    const manyLegs: RouteSegment[] = Array.from({ length: 6 }, (_, i) => ({
      from: `Stop ${i}`,
      to: `Stop ${i + 1}`,
      distanceKm: 3,
      durationMin: 12,
      cost: 0,
    }));
    const priced = allocateRouteSegmentCosts(
      manyLegs,
      plan({ transportationType: "public-transportation" }),
      city,
    );
    const billable = priced.filter((s) => s.distanceKm > 0);
    expect(billable[0]!.cost).toBeGreaterThan(0);
    expect(billable[0]!.provider).toBe("Day pass");
    expect(billable.slice(1).every((s) => s.cost === 0 && s.provider === "Day pass")).toBe(true);
  });

  it("splits individual transit tickets across each billable leg", () => {
    const priced = allocateRouteSegmentCosts(
      segments,
      plan({
        transportationType: "public-transportation",
        adults: 1,
        children: [],
      }),
      city,
    );
    const billable = priced.filter((s) => s.distanceKm > 0);
    // 2 rides × 1 rider — usually cheaper as individual tickets than a day pass.
    expect(billable.every((s) => s.cost > 0)).toBe(true);
  });
});
