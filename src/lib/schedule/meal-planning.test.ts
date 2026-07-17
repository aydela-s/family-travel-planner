import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import {
  isDinnerMeal,
  rescheduleActivitiesWithMealAnchors,
} from "@/lib/schedule/meal-planning";
import { activitiesOverlap, defaultTravelMin, parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function balancedPlan(children: number[], overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(34),
    adults: 2,
    children,
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("meal scheduling — no gaps or dinner overlap", () => {
  it("does not leave a multi-hour gap after lunch when naps are disabled", () => {
    const plan = balancedPlan([5, 10]);
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const lunch = scheduled.find(
      (a) => a.type === "meal" && parseTimeToMinutes(a.time) < 16 * 60,
    );
    expect(lunch).toBeDefined();

    const lunchIdx = scheduled.indexOf(lunch!);
    const next = scheduled[lunchIdx + 1];
    const gap = parseTimeToMinutes(next.time) - parseTimeToMinutes(lunch!.endTime!);
    expect(gap).toBeLessThanOrEqual(25);
  });

  it("never schedules dinner before the last afternoon item ends", () => {
    const plan = balancedPlan([5, 10]);
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const dinner = scheduled.find((a) => isDinnerMeal(a));
    const lastBeforeDinner = scheduled
      .filter((a) => !isDinnerMeal(a))
      .reduce((latest, a) => Math.max(latest, parseTimeToMinutes(a.endTime!)), 0);

    expect(dinner).toBeDefined();
    expect(parseTimeToMinutes(dinner!.time)).toBeGreaterThanOrEqual(lastBeforeDinner);
    expect(activitiesOverlap(scheduled)).toBe(false);
  });

  it("chains afternoon items from the nap cursor instead of jumping to skeleton times", () => {
    const plan = balancedPlan([2, 5], { napSchedule: "Early afternoon (1–3 PM)" });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const nap = scheduled.find((a) => a.type === "nap");
    const afterNap = scheduled.find(
      (a) => a.type === "activity" && parseTimeToMinutes(a.time) > parseTimeToMinutes(nap!.endTime!),
    );

    expect(nap).toBeDefined();
    expect(afterNap).toBeDefined();
    expect(parseTimeToMinutes(afterNap!.time) - parseTimeToMinutes(nap!.endTime!)).toBeLessThanOrEqual(
      defaultTravelMin(plan),
    );
  });

  it("fixRawDayActivities produces a valid day schedule", () => {
    const plan = balancedPlan([5, 10]);
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });
});
