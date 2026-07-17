import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import {
  rescheduleEnrichedActivities,
  travelGapsFromSegments,
} from "@/lib/schedule/fix-itinerary";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import { ItineraryActivity } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function airbnbCookPlan(): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [5, 10],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "airbnb_with_kitchen",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
  };
}

describe("enrich scheduling — Phase B", () => {
  it("maps one segment duration per consecutive located activity pair", () => {
    const plan = airbnbCookPlan();
    const activities: ItineraryActivity[] = [
      {
        time: "10:00",
        title: "Morning",
        type: "activity",
        timeOfDay: "morning",
        location: { name: "A", lat: 48.86, lng: 2.34 },
      },
      {
        time: "12:00",
        title: "Lunch",
        type: "meal",
        timeOfDay: "afternoon",
        location: { name: "B", lat: 48.861, lng: 2.341 },
      },
      {
        time: "15:00",
        title: "Grocery stop for dinner ingredients",
        type: "activity",
        timeOfDay: "afternoon",
        location: { name: "C", lat: 48.862, lng: 2.342 },
      },
    ];

    // Nearby legs: estimate ≈ defaultTravelMin; short segments stay unpadded.
    const gaps = travelGapsFromSegments(activities, [12, 18], plan);
    expect(gaps).toEqual([12, 18]);
  });

  it("applies a traffic pad when enrich segment greatly exceeds the haversine estimate", () => {
    const plan = airbnbCookPlan();
    const nearbyA = { name: "A", lat: 48.86, lng: 2.34 };
    const nearbyB = { name: "B", lat: 48.861, lng: 2.341 };
    const activities: ItineraryActivity[] = [
      {
        time: "10:00",
        title: "Morning",
        type: "activity",
        timeOfDay: "morning",
        location: nearbyA,
      },
      {
        time: "12:00",
        title: "Lunch",
        type: "meal",
        timeOfDay: "afternoon",
        location: nearbyB,
      },
    ];

    const gaps = travelGapsFromSegments(activities, [45], plan);
    // Nearby estimate is ~defaultTravelMin (20); 45 > 20*1.5 → ceil(45*1.15)=52
    expect(gaps[0]).toBe(52);
  });

  it("rescheduleEnrichedActivities preserves locations and costs", () => {
    const activities: ItineraryActivity[] = [
      {
        time: "10:00",
        title: "Morning at Louvre",
        type: "activity",
        timeOfDay: "morning",
        activityCost: 42,
        location: { name: "Louvre", lat: 48.86, lng: 2.34 },
      },
      {
        time: "12:30",
        title: "Lunch in cafe area",
        type: "meal",
        timeOfDay: "afternoon",
        activityCost: 0,
        location: { name: "Cafe", lat: 48.87, lng: 2.35 },
      },
    ];

    const rescheduled = rescheduleEnrichedActivities(activities, airbnbCookPlan(), [25]);
    expect(rescheduled[0].location?.name).toBe("Louvre");
    expect(rescheduled[0].activityCost).toBe(42);
    expect(rescheduled.every((a) => a.timeOfDay)).toBe(true);
  });

  it("does not duplicate nap blocks when re-timing enriched activities", () => {
    const plan: TripPlan = {
      ...airbnbCookPlan(),
      children: [3],
      napSchedule: "Early afternoon (1–3 PM)",
    };
    const { raw } = planTrip(plan);
    const enriched: ItineraryActivity[] = raw.days[0].activities.map((a) => ({
      ...a,
      timeOfDay: "morning",
      location: { name: "Spot", lat: 48.86, lng: 2.34 },
    }));

    const rescheduled = rescheduleEnrichedActivities(enriched, plan, [15, 15, 15]);
    const napCount = rescheduled.filter((a) => a.type === "nap").length;
    expect(napCount).toBe(1);
    expect(validateDaySchedule(rescheduled, plan)).toEqual([]);
  });

  it("uses longer segment durations to push later items later in the day", () => {
    const plan = airbnbCookPlan();
    const activities: ItineraryActivity[] = [
      {
        time: "10:00",
        title: "Morning at Louvre",
        type: "activity",
        timeOfDay: "morning",
        location: { name: "Louvre", lat: 48.86, lng: 2.34 },
      },
      {
        time: "12:30",
        title: "Lunch in cafe area",
        type: "meal",
        timeOfDay: "afternoon",
        location: { name: "Cafe", lat: 48.87, lng: 2.35 },
      },
      {
        time: "15:30",
        title: "Afternoon at Park",
        type: "activity",
        timeOfDay: "afternoon",
        location: { name: "Park", lat: 48.88, lng: 2.36 },
      },
    ];

    const shortTravel = rescheduleEnrichedActivities(activities, plan, [10, 10]);
    const longTravel = rescheduleEnrichedActivities(activities, plan, [45, 45]);

    const shortAfternoon = shortTravel.find((a) => a.title.includes("Afternoon"))!;
    const longAfternoon = longTravel.find((a) => a.title.includes("Afternoon"))!;
    expect(longAfternoon.time > shortAfternoon.time).toBe(true);
  });
});
