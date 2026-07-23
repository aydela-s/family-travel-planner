import { describe, expect, it } from "vitest";
import { detectCity } from "@/lib/city-detect";
import { planTrip } from "@/lib/planning-engine";
import { lunchLabel, usesNamedRestaurant } from "@/lib/planning-engine/meal-planner";
import { estimateMealCosts } from "@/lib/pricing/budget";
import {
  MIN_LUNCH_DURATION_MIN,
  rescheduleActivitiesWithMealAnchors,
} from "@/lib/schedule/meal-planning";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";
import { ItineraryActivity } from "@/types/itinerary";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(33),
    adults: 1,
    children: [2, 4, 6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: ["Zoos & Aquariums", "Parks & Gardens"],
    ...overrides,
  };
}

describe("adaptive lunch before nap", () => {
  it("keeps lunch ≥40 minutes when a noon nap follows an early morning stop", () => {
    const trip = plan({
      children: [8, 3],
      napSchedule: "12-2",
      destination: "Paris",
    });
    const { raw } = planTrip(trip);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, trip);
    const lunch = scheduled.find(
      (a) => a.type === "meal" && parseTimeToMinutes(a.time) < 16 * 60,
    );
    const nap = scheduled.find((a) => a.type === "nap");
    expect(lunch).toBeDefined();
    expect(nap).toBeDefined();
    const lunchDur =
      parseTimeToMinutes(lunch!.endTime!) - parseTimeToMinutes(lunch!.time);
    expect(lunchDur).toBeGreaterThanOrEqual(MIN_LUNCH_DURATION_MIN);
    expect(parseTimeToMinutes(lunch!.endTime!)).toBeLessThanOrEqual(
      parseTimeToMinutes(nap!.time),
    );
  });
});

describe("balanced afternoon → dinner gap", () => {
  it("adds an evening stroll and avoids a 3+ hour void before dinner", () => {
    const trip = plan({ napSchedule: "No naps needed", children: [5, 10] });
    const { raw } = planTrip(trip);
    const day = raw.days[0].activities;
    expect(day.some((a) => /stroll|evening|unwind/i.test(a.title))).toBe(true);

    const scheduled = rescheduleActivitiesWithMealAnchors(day, trip);
    const dinnerS = scheduled.find((a) => a.type === "meal" && /dinner/i.test(a.title))!;
    const prior = scheduled
      .filter((a) => a !== dinnerS)
      .reduce((m, a) => Math.max(m, parseTimeToMinutes(a.endTime ?? a.time)), 0);
    const gap = parseTimeToMinutes(dinnerS.time) - prior;
    expect(gap).toBeLessThanOrEqual(120);
  });
});

describe("balanced food budget", () => {
  it("does not name restaurants for balanced breakfast or lunch", () => {
    expect(usesNamedRestaurant(plan(), "breakfast")).toBe(false);
    expect(usesNamedRestaurant(plan(), "lunch")).toBe(false);
    expect(usesNamedRestaurant(plan(), "dinner")).toBe(true);
    expect(usesNamedRestaurant(plan({ budgetStyle: "splurge" }), "lunch")).toBe(true);
  });

  it("prices balanced days well below three full restaurant meals", () => {
    const trip = plan();
    const { raw } = planTrip(trip);
    const city = detectCity(trip.destination);
    const meals = raw.days[0].activities
      .filter((a) => a.type === "meal")
      .map(
        (a): ItineraryActivity => ({
          ...a,
          timeOfDay: "afternoon",
        }),
      );
    const food = estimateMealCosts(meals, city, trip);
    // Restaurant ×3 × family units(~2.2) ≈ $374; balanced should be far lower.
    expect(food).toBeLessThan(220);
    expect(lunchLabel(trip, "Balboa Park").title).toMatch(/picnic|sandwich/i);
  });
});

describe("cross-day landmark variety", () => {
  it("does not repeat the same morning landmark every day when the catalog has alternatives", () => {
    const trip = plan({
      destination: "San Diego",
      budgetStyle: "splurge",
      interests: ["Museums & Art", "Parks & Gardens", "Zoos & Aquariums"],
    });
    const { raw } = planTrip(trip);
    const mornings = raw.days.map((d) => {
      const act = d.activities.find(
        (a) =>
          a.type === "activity" &&
          /^(Explore|Visit|Family time at)\s+/i.test(a.title) &&
          parseTimeToMinutes(a.time) < 13 * 60,
      );
      return act?.title.replace(/^(Explore|Visit|Family time at)\s+/i, "").trim();
    });
    const unique = new Set(mornings.filter(Boolean));
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});
