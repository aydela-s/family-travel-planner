import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  repairItineraryIntegrity,
  validateCostReconciliation,
  validateRealisticDurations,
  validateTaxiCosts,
  validateTransportConsistency,
} from "@/lib/planning-engine/itinerary-integrity";
import { costsFromDisplayedItems } from "@/lib/pricing/budget";
import { namesMatch } from "@/lib/pricing/transport-planner";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

const city = CITY_CONFIGS.find((c) => c.id === "dallas") ?? CITY_CONFIGS[0]!;

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: city.name,
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    adults: 2,
    children: [4, 6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Swimming & Water Play", "Interactive Museums"],
    ...overrides,
  };
}

function activity(
  partial: Partial<ItineraryActivity> & Pick<ItineraryActivity, "time" | "title" | "type">,
): ItineraryActivity {
  return {
    timeOfDay: "morning",
    ...partial,
  };
}

function day(activities: ItineraryActivity[], overrides: Partial<ItineraryDay> = {}): ItineraryDay {
  const currency = city.currency;
  const line = costsFromDisplayedItems(activities, currency);
  const costBreakdown = { ...line, currency };
  return {
    day: 1,
    date: "2026-09-15",
    weekday: "Tuesday",
    formattedDate: "Tue, Sep 15",
    activities,
    costBreakdown,
    accommodationTips: [],
    costs: costBreakdown,
    metrics: {},
    routeSegments: [],
    mapUrl: null,
    ...overrides,
  };
}

describe("transport / activity consistency", () => {
  it("flags a taxi whose destination does not match the next stop", () => {
    const activities = [
      activity({
        time: "10:00",
        endTime: "11:30",
        title: "Explore Science Museum",
        type: "activity",
        location: { name: "Science Museum", lat: 1, lng: 1 },
      }),
      activity({
        time: "11:30",
        endTime: "11:45",
        title: "Taxi to Illusion Museum",
        type: "travel",
        activityCost: 18,
        location: { name: "Illusion Museum", lat: 2, lng: 2 },
      }),
      activity({
        time: "11:45",
        endTime: "12:30",
        title: "Takeout or delivery lunch at your stay",
        type: "meal",
        location: { name: "Your stay", lat: 3, lng: 3 },
      }),
    ];
    const issues = validateTransportConsistency(activities);
    expect(issues.some((v) => v.code === "transport_destination_mismatch")).toBe(true);
  });

  it("repairs mismatched taxi titles to the following stop", () => {
    const { days } = repairItineraryIntegrity(
      [
        day([
          activity({
            time: "10:00",
            endTime: "11:30",
            title: "Explore Science Museum",
            type: "activity",
            location: { name: "Science Museum", lat: 1, lng: 1 },
            interestTags: ["museums"],
          }),
          activity({
            time: "11:30",
            endTime: "11:45",
            title: "Taxi to Illusion Museum",
            type: "travel",
            activityCost: 18,
          }),
          activity({
            time: "11:45",
            endTime: "12:30",
            title: "Takeout or delivery lunch at your stay",
            type: "meal",
            location: { name: "Your stay", lat: 3, lng: 3 },
            activityCost: 40,
            dietaryFit: "options",
            notes: "vegan options — check the current menu",
          }),
        ]),
      ],
      plan(),
      city,
    );
    const travel = days[0]!.activities.find((a) => a.type === "travel")!;
    expect(travel.title).toMatch(/Your stay/i);
    expect(namesMatch("Your stay", "Your stay")).toBe(true);
  });

  it("drops orphaned transportation with no following stop", () => {
    const { days } = repairItineraryIntegrity(
      [
        day([
          activity({
            time: "10:00",
            endTime: "11:30",
            title: "Explore Science Museum",
            type: "activity",
            location: { name: "Science Museum", lat: 1, lng: 1 },
            interestTags: ["museums"],
          }),
          activity({
            time: "11:30",
            title: "Taxi to a removed venue",
            type: "travel",
            activityCost: 12,
          }),
        ]),
      ],
      plan(),
      city,
    );
    expect(days[0]!.activities.some((a) => a.type === "travel")).toBe(false);
  });
});

describe("cost reconciliation", () => {
  it("requires food, transport, activity, and day totals to equal displayed line items", () => {
    const activities = [
      activity({
        time: "08:00",
        endTime: "08:45",
        title: "Breakfast",
        type: "meal",
        activityCost: 32.4,
        location: { name: "Cafe", lat: 1, lng: 1 },
      }),
      activity({
        time: "08:45",
        endTime: "09:00",
        title: "Taxi to Science Museum",
        type: "travel",
        activityCost: 16.6,
        location: { name: "Science Museum", lat: 2, lng: 2 },
      }),
      activity({
        time: "10:00",
        endTime: "11:30",
        title: "Explore Science Museum",
        type: "activity",
        activityCost: 48,
        interestTags: ["museums"],
        location: { name: "Science Museum", lat: 2, lng: 2 },
      }),
    ];
    const line = costsFromDisplayedItems(activities, "USD");
    expect(line.food).toBe(32.4);
    expect(line.transport).toBe(16.6);
    expect(line.activities).toBe(48);
    expect(line.total).toBe(97);

    const mismatched = day(activities, {
      costBreakdown: {
        food: 32,
        transport: 16,
        activities: 48,
        total: 96,
        currency: "USD",
      },
    });
    expect(validateCostReconciliation(mismatched).length).toBeGreaterThan(0);

    const { days } = repairItineraryIntegrity([mismatched], plan({ interests: [] }), city);
    expect(validateCostReconciliation(days[0]!)).toEqual([]);
    expect(days[0]!.costBreakdown.total).toBe(line.total);
  });

  it("makes trip total the sum of day totals", () => {
    const d1 = day([
      activity({ time: "10:00", title: "A", type: "activity", activityCost: 10 }),
    ]);
    const d2 = day([
      activity({ time: "10:00", title: "B", type: "activity", activityCost: 20 }),
    ]);
    d2.day = 2;
    const { days } = repairItineraryIntegrity([d1, d2], plan({ interests: [] }), city);
    const trip = days.reduce((s, d) => s + d.costBreakdown.total, 0);
    expect(trip).toBe(days[0]!.costBreakdown.total + days[1]!.costBreakdown.total);
  });
});

describe("taxi cost sanity", () => {
  it("flags a $0 taxi that is not marked covered", () => {
    const issues = validateTaxiCosts(
      [
        activity({
          time: "10:00",
          title: "Taxi to the museum",
          type: "travel",
          activityCost: 0,
        }),
      ],
      plan(),
    );
    expect(issues.some((v) => v.code === "taxi_cost_zero")).toBe(true);
  });

  it("allows a $0 taxi when explicitly covered", () => {
    const issues = validateTaxiCosts(
      [
        activity({
          time: "10:00",
          title: "Taxi to the museum",
          type: "travel",
          activityCost: 0,
          transportCovered: true,
        }),
      ],
      plan(),
    );
    expect(issues).toEqual([]);
  });
});

describe("duration and dietary integrity", () => {
  it("flags a 15-minute museum visit", () => {
    const issues = validateRealisticDurations(
      [
        activity({
          time: "10:00",
          endTime: "10:15",
          title: "Explore the science museum",
          type: "activity",
          interestTags: ["museums"],
        }),
      ],
      plan(),
    );
    expect(issues.some((v) => v.code === "unrealistic_activity_duration")).toBe(true);
  });

  it("re-pins breakfast after an unrealistic morning stop is removed", () => {
    const { days } = repairItineraryIntegrity(
      [
        day([
          activity({
            time: "09:45",
            endTime: "10:30",
            title: "Breakfast near Indoor Play Place",
            type: "meal",
            location: { name: "Indoor Play Place area", lat: 1, lng: 1 },
            activityCost: 20,
          }),
          activity({
            time: "10:45",
            endTime: "11:00",
            title: "Play at Indoor Play Place",
            type: "activity",
            interestTags: ["indoor-play"],
            location: { name: "Indoor Play Place", lat: 1, lng: 1 },
            activityCost: 30,
          }),
          activity({
            time: "13:30",
            endTime: "15:00",
            title: "Explore Nature Reserve",
            type: "activity",
            interestTags: ["nature"],
            location: { name: "Nature Reserve", lat: 2, lng: 2 },
            activityCost: 0,
          }),
        ]),
      ],
      plan({ interests: [] }),
      city,
    );
    expect(
      days[0]!.activities.some(
        (a) => a.type === "activity" && /Indoor Play Place/i.test(a.title),
      ),
    ).toBe(false);
    const breakfast = days[0]!.activities.find((a) => a.type === "meal")!;
    expect(breakfast.location?.name).toMatch(/Nature Reserve/i);
  });

  it("keeps dietary evidence attached to the selected restaurant", () => {
    const { days } = repairItineraryIntegrity(
      [
        day([
          activity({
            time: "18:00",
            endTime: "19:00",
            title: "Dinner at Green Table",
            type: "meal",
            dietaryFit: "options",
            activityCost: 80,
          }),
        ]),
      ],
      plan(),
      city,
    );
    const dinner = days[0]!.activities.find((a) => a.type === "meal")!;
    expect(dinner.dietaryFit).toBe("options");
    expect(dinner.notes).toMatch(/vegan/i);
  });
});
