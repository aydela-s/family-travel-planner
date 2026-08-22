import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import { duplicateDayCategories } from "@/lib/planning-engine/validate-itinerary";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import type { ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-20",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
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

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

function asDay(raw: { day: number; activities: unknown[] }): ItineraryDay {
  return {
    ...raw,
    date: "2026-09-15",
    title: `Day ${raw.day}`,
    routeSegments: [],
    dailyCost: 0,
  } as unknown as ItineraryDay;
}

describe("category balancing in a generated plan", () => {
  const trip = plan();
  const { raw } = planTrip(trip, { cityOverride: city });
  const days = raw.days.map(asDay);

  it("never repeats a category within a day", () => {
    for (const day of days) {
      expect(duplicateDayCategories(day), `day ${day.day}`).toEqual([]);
    }
  });

  it("only uses an unselected category once no uncovered selected interest has a candidate", () => {
    const selected = new Set(interestTagsFromPlan(trip.interests));
    const stops = days.flatMap((d) =>
      d.activities.filter((a) => a.type === "activity" && a.interestTags?.length),
    );
    expect(stops.length).toBeGreaterThan(0);

    const scheduledTags = new Set(stops.flatMap((a) => a.interestTags ?? []));
    const usedNames = new Set(stops.map((a) => a.location?.name).filter(Boolean));
    const uncovered = [...selected].filter((tag) => !scheduledTags.has(tag));

    for (const stop of stops) {
      const onInterest = stop.interestTags!.some((t) => selected.has(t));
      if (onInterest || uncovered.length === 0) continue;
      // An off-interest stop while a selected interest is still missing is only
      // allowed when the city had nothing left to satisfy that interest.
      const available = city.landmarks.filter(
        (l) => !usedNames.has(l.name) && l.interestTags.some((t) => uncovered.includes(t)),
      );
      expect(available.map((l) => l.name), `"${stop.title}" is off-interest`).toEqual([]);
    }
  });

  it("covers most selected interests across the trip", () => {
    const scheduled = new Set(
      days.flatMap((d) => d.activities.flatMap((a) => a.interestTags ?? [])),
    );
    const labelsCovered = trip.interests.filter((label) =>
      (interestTagsFromPlan([label]) ?? []).some((tag) => scheduled.has(tag)),
    );
    expect(labelsCovered.length).toBeGreaterThanOrEqual(trip.interests.length - 1);
  });

  it("does not fall back to unselected categories while interests are uncovered", () => {
    const selected = new Set(interestTagsFromPlan(trip.interests));
    const scheduled = new Set(
      days.flatMap((d) => d.activities.flatMap((a) => a.interestTags ?? [])),
    );
    const uncovered = [...selected].filter((tag) => !scheduled.has(tag));
    const offInterest = days
      .flatMap((d) => d.activities)
      .filter(
        (a) =>
          a.type === "activity" &&
          a.interestTags?.length &&
          !a.interestTags.some((t) => selected.has(t)),
      );
    // Filler from an unselected category is only acceptable once nothing is missing.
    if (uncovered.length > 0) expect(offInterest).toHaveLength(0);
  });
});
