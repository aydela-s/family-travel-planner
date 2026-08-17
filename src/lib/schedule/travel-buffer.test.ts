import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { scheduledSegmentMinutes } from "@/lib/maps/route-segments";
import { pureTravelMin } from "@/lib/maps/travel-estimate";
import { allocateRouteSegmentCosts, injectTravelActivities } from "@/lib/pricing/transport-planner";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import {
  childHandlingBufferMin,
  familyTravelBufferMin,
  scheduledTravelMin,
  travelBufferNote,
} from "@/lib/schedule/travel-buffer";
import type { ItineraryActivity, RouteSegment } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [3],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("driving time vs. family travel time", () => {
  it("keeps the reported driving time free of parking and kid-wrangling", () => {
    const from = { lat: 32.73, lng: -117.15 };
    const to = { lat: 32.75, lng: -117.17 };
    const driving = pureTravelMin(from, to, plan());
    const scheduled = scheduledTravelMin(driving, plan());
    expect(scheduled).toBeGreaterThan(driving);
    expect(scheduled - driving).toBe(familyTravelBufferMin(plan()));
  });

  it("adds more overhead for a car than for walking", () => {
    expect(familyTravelBufferMin(plan({ transportationType: "car-rental" }))).toBeGreaterThan(
      familyTravelBufferMin(plan({ transportationType: "walking" })),
    );
  });

  it("adds more overhead for a toddler than for a teen", () => {
    expect(childHandlingBufferMin([2])).toBeGreaterThan(childHandlingBufferMin([14]));
    expect(childHandlingBufferMin([])).toBe(0);
  });

  it("schedules travel plus buffer while the segment keeps the true driving time", () => {
    const segments: RouteSegment[] = [
      { from: "A", to: "B", distanceKm: 8.4, durationMin: 10, bufferMin: 20, cost: 0 },
      { from: "B", to: "B", distanceKm: 0, durationMin: 0, cost: 0 },
    ];
    const [hop, sameSpot] = scheduledSegmentMinutes(segments, plan());
    expect(hop).toBe(30);
    expect(sameSpot).toBe(0);
    expect(segments[0]!.durationMin).toBe(10);
  });

  it("reports driving time on the timeline without the family buffer in the notes", () => {
    const stops: ItineraryActivity[] = [
      {
        time: "10:00",
        endTime: "11:30",
        title: "Explore Balboa Park",
        type: "activity",
        location: { name: "Balboa Park", lat: 32.73, lng: -117.15 },
      },
      {
        time: "12:15",
        endTime: "13:15",
        title: "Lunch at Kono's Cafe",
        type: "meal",
        location: { name: "La Jolla Cove", lat: 32.85, lng: -117.27 },
      },
    ];
    const segments = allocateRouteSegmentCosts(
      [{ from: "Balboa Park", to: "La Jolla Cove", distanceKm: 8.4, durationMin: 10, cost: 0 }],
      plan(),
      city,
    );
    const travel = injectTravelActivities(stops, segments, plan(), city.currencySymbol).find(
      (a) => a.type === "travel",
    )!;

    expect(travel.notes).toContain("~10 min driving");
    expect(travel.notes).toContain("5.2 mi");
    expect(travel.notes).not.toMatch(/allow ~/);
  });

  it("starts the first taxi before breakfast, not at the same clock time", () => {
    const stops: ItineraryActivity[] = [
      {
        time: "09:15",
        endTime: "10:00",
        title: "Breakfast near Kids Empire",
        type: "meal",
        location: { name: "Kids Empire café", lat: 32.88, lng: -96.77 },
      },
      {
        time: "10:00",
        endTime: "11:30",
        title: "Family time at Kids Empire",
        type: "activity",
        location: { name: "Kids Empire", lat: 32.88, lng: -96.77 },
      },
    ];
    const segments: RouteSegment[] = [
      {
        from: "Your stay",
        to: "Kids Empire café",
        distanceKm: 12,
        durationMin: 20,
        bufferMin: 16,
        cost: 18,
      },
    ];
    const withTravel = injectTravelActivities(stops, segments, plan({ transportationType: "taxis" }));
    const taxi = withTravel.find((a) => a.type === "travel")!;
    expect(parseTimeToMinutes(taxi.time)).toBeLessThan(parseTimeToMinutes("09:15"));
    expect(parseTimeToMinutes(taxi.time)).toBeGreaterThanOrEqual(parseTimeToMinutes("08:30"));
    expect(parseTimeToMinutes(taxi.time)).toBeLessThan(parseTimeToMinutes("09:00"));
    expect(withTravel[withTravel.length - 1]!.type).not.toBe("travel");
  });

  it("puts the taxi home after dinner, not between the restaurant hop and the meal", () => {
    const stops: ItineraryActivity[] = [
      {
        time: "16:00",
        endTime: "17:30",
        title: "Family time at the playground",
        type: "activity",
        location: { name: "Kids Empire", lat: 32.88, lng: -96.77 },
      },
      {
        time: "18:00",
        endTime: "19:00",
        title: "Dinner at Pecan Lodge",
        type: "meal",
        slotKind: "dinner",
        location: { name: "Pecan Lodge", lat: 32.79, lng: -96.78 },
      },
    ];
    const segments: RouteSegment[] = [
      {
        from: "Kids Empire",
        to: "Pecan Lodge",
        distanceKm: 8,
        durationMin: 15,
        bufferMin: 10,
        cost: 14,
      },
      {
        from: "Pecan Lodge",
        to: "Your stay",
        distanceKm: 10,
        durationMin: 18,
        bufferMin: 10,
        cost: 16,
      },
    ];
    const withTravel = injectTravelActivities(stops, segments, plan({ transportationType: "taxis" }));
    const titles = withTravel.map((a) => a.title);
    const dinnerIdx = titles.findIndex((t) => t.startsWith("Dinner"));
    const homeIdx = titles.findIndex((t) => /taxi to your stay/i.test(t));
    const toDinnerIdx = titles.findIndex((t) => /taxi to pecan lodge/i.test(t));
    expect(toDinnerIdx).toBeGreaterThanOrEqual(0);
    expect(dinnerIdx).toBeGreaterThan(toDinnerIdx);
    expect(homeIdx).toBeGreaterThan(dinnerIdx);
  });

  it("explains what the extra minutes are for", () => {
    expect(travelBufferNote(plan({ transportationType: "car-rental" }), 10)).toMatch(/parking/);
    expect(travelBufferNote(plan({ transportationType: "taxis" }), 10)).toMatch(/ride/);
    expect(travelBufferNote(plan({ transportationType: "public-transportation" }), 10)).toMatch(
      /stop/,
    );
  });
});
