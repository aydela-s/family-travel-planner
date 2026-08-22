import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type Landmark } from "@/config/city-pricing";
import {
  categoryBearingStops,
  repairClosedVenues,
  repairSameDayVenueRepeats,
  validateItinerary,
} from "@/lib/planning-engine/validate-itinerary";
import { shouldShowLineItemCost } from "@/lib/format";
import { formatCompactActivityLines } from "@/lib/itinerary-export";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-16",
    adults: 2,
    children: [6, 9],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Interactive Museums", "Parks & Gardens"],
    ...overrides,
  };
}

function activity(overrides: Partial<ItineraryActivity>): ItineraryActivity {
  return {
    time: "10:00",
    title: "Explore Test Place",
    type: "activity",
    timeOfDay: "morning",
    ...overrides,
  };
}

describe("enrich hard rules (FAM-84 rules 2, 3, 17)", () => {
  it("shouldShowLineItemCost hides free and covered transport (rule 17)", () => {
    expect(shouldShowLineItemCost({ activityCost: 0 })).toBe(false);
    expect(shouldShowLineItemCost({ activityCost: 25 })).toBe(true);
    expect(shouldShowLineItemCost({ activityCost: 0, transportCovered: true })).toBe(false);
    expect(
      formatCompactActivityLines(
        activity({ type: "meal", activityCost: 0 }),
        "$",
      ).summary,
    ).not.toMatch(/\$0/);
    expect(
      formatCompactActivityLines(
        activity({ type: "travel", activityCost: 0 }),
        "$",
      ).summary,
    ).not.toMatch(/\$0/);
  });

  it("repairSameDayVenueRepeats replaces a duplicate venue on one day (rule 3)", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;
    const trip = plan();
    const repaired = repairSameDayVenueRepeats(
      [
        activity({
          title: "Explore Fleet Science Center",
          location: { name: fleet.name, lat: fleet.lat, lng: fleet.lng },
          interestTags: fleet.interestTags,
        }),
        activity({
          time: "14:00",
          title: "Explore Fleet Science Center",
          location: { name: fleet.name, lat: fleet.lat, lng: fleet.lng },
          interestTags: fleet.interestTags,
          timeOfDay: "afternoon",
        }),
      ],
      trip,
      city,
    );
    const venues = categoryBearingStops({
      day: 1,
      date: "2026-09-15",
      weekday: "Tuesday",
      formattedDate: "",
      activities: repaired,
      costBreakdown: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
      accommodationTips: [],
      costs: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
      metrics: {},
      routeSegments: [],
      mapUrl: null,
    }).map((a) => a.location?.name);
    expect(venues.filter((n) => n === fleet.name).length).toBe(1);
    expect(venues.some((n) => n && n !== fleet.name)).toBe(true);
  });

  it("repairClosedVenues swaps a reliably closed landmark (rule 2)", () => {
    const closedMonday: Landmark = {
      name: "Closed Monday Museum",
      lat: 32.72,
      lng: -117.16,
      adultPrice: 20,
      intensity: "medium",
      ageTags: ["child"],
      interestTags: ["museums"],
      indoor: true,
      openingHours: { open: "10:00", close: "17:00" },
      hoursByWeekday: {
        0: { open: "10:00", close: "17:00" },
        1: null,
        2: { open: "10:00", close: "17:00" },
        3: { open: "10:00", close: "17:00" },
        4: { open: "10:00", close: "17:00" },
        5: { open: "10:00", close: "17:00" },
        6: { open: "10:00", close: "17:00" },
      },
      hoursConfidence: "verified",
    };
    const openPark: Landmark = {
      name: "Open Park Nearby",
      lat: 32.721,
      lng: -117.161,
      adultPrice: 0,
      intensity: "low",
      ageTags: ["child"],
      interestTags: ["parks"],
      indoor: false,
      openingHours: { open: "08:00", close: "20:00" },
    };
    const city = {
      ...CITY_CONFIGS[0]!,
      id: "test-city",
      landmarks: [closedMonday, openPark],
    };
    const trip = plan({ startDate: "2026-09-14", endDate: "2026-09-14" }); // Monday
    const days: ItineraryDay[] = [
      {
        day: 1,
        date: "2026-09-14",
        weekday: "Monday",
        formattedDate: "",
        activities: [
          activity({
            time: "10:00",
            endTime: "12:00",
            title: "Explore Closed Monday Museum",
            location: { name: closedMonday.name, lat: closedMonday.lat, lng: closedMonday.lng },
            interestTags: ["museums"],
          }),
        ],
        costBreakdown: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
        accommodationTips: [],
        costs: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
        metrics: {},
        routeSegments: [],
        mapUrl: null,
      },
    ];
    const repaired = repairClosedVenues(days, trip, city);
    expect(repaired[0]!.activities[0]!.location?.name).not.toBe(closedMonday.name);
    expect(repaired[0]!.activities[0]!.location?.name).toBe(openPark.name);
  });

  it("validateItinerary flags trip-wide venue reuse via category-bearing stops (rule 3)", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;
    const trip = plan();
    const violations = validateItinerary(
      [
        {
          day: 1,
          date: "2026-09-15",
          weekday: "Tuesday",
          formattedDate: "",
          activities: [
            activity({
              title: "Explore Fleet Science Center",
              location: { name: fleet.name, lat: fleet.lat, lng: fleet.lng },
              interestTags: fleet.interestTags,
            }),
          ],
          costBreakdown: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
          accommodationTips: [],
          costs: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
          metrics: {},
          routeSegments: [],
          mapUrl: null,
        },
        {
          day: 2,
          date: "2026-09-16",
          weekday: "Wednesday",
          formattedDate: "",
          activities: [
            activity({
              title: "Explore Fleet Science Center",
              location: { name: fleet.name, lat: fleet.lat, lng: fleet.lng },
              interestTags: fleet.interestTags,
            }),
          ],
          costBreakdown: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
          accommodationTips: [],
          costs: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
          metrics: {},
          routeSegments: [],
          mapUrl: null,
        },
      ],
      trip,
      city,
    );
    expect(violations.some((v) => v.code === "activity_reused")).toBe(true);
  });
});
