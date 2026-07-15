import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { isDaytimeMeal, isDinnerMeal, isGroceryActivity, rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan>): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(34),
    adults: 2,
    children: [5, 10],
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

function scheduleDay1(plan: TripPlan) {
  const { raw } = planTrip(plan);
  return rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
}

const NAP_OPTIONS = [
  { label: "no naps", napSchedule: "No naps needed" },
  { label: "afternoon nap", napSchedule: "Early afternoon (1–3 PM)" },
  { label: "morning nap", napSchedule: "Morning nap (~9–11 AM)" },
] as const;

const FAMILY_OPTIONS = [
  { label: "toddler", children: [3] },
  { label: "mixed ages", children: [5, 10] },
  { label: "teens", children: [12, 15] },
  { label: "adults only", children: [] as number[] },
] as const;

const STYLE_OPTIONS = ["relaxed", "balanced", "packed"] as const;

describe("schedule invariant matrix", () => {
  it.each(
    NAP_OPTIONS.flatMap((nap) =>
      FAMILY_OPTIONS.flatMap((family) =>
        STYLE_OPTIONS.map((style) => ({
          name: `${style} / ${family.label} / ${nap.label}`,
          plan: basePlan({
            children: [...family.children],
            travelStyle: style,
            napSchedule: nap.napSchedule,
          }),
        })),
      ),
    ),
  )("produces a valid day — $name", ({ plan }) => {
    const scheduled = scheduleDay1(plan);
    const violations = validateDaySchedule(scheduled, plan);
    expect(violations, violations.map((v) => v.message).join("; ")).toEqual([]);
  });

  it("keeps morning activity with morning nap preference", () => {
    const plan = basePlan({
      children: [3],
      napSchedule: "Morning nap (~9–11 AM)",
    });
    const scheduled = scheduleDay1(plan);
    const morningActivity = scheduled.find(
      (a) => a.type === "activity" && parseTimeToMinutes(a.time) < 12 * 60,
    );
    expect(morningActivity).toBeDefined();
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("keeps lunch inside age window for young kids on packed days", () => {
    const plan = basePlan({
      children: [4, 6],
      travelStyle: "packed",
      napSchedule: "No naps needed",
    });
    const scheduled = scheduleDay1(plan);
    const lunch = scheduled.find(isDaytimeMeal);
    expect(lunch).toBeDefined();
    const start = parseTimeToMinutes(lunch!.time);
    expect(start).toBeGreaterThanOrEqual(11 * 60 + 30);
    expect(start).toBeLessThanOrEqual(12 * 60);
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("schedules cook-night grocery before dinner without overlap", () => {
    const plan = basePlan({
      children: [5, 10],
      accommodationType: "airbnb_with_kitchen",
      travelStyle: "balanced",
    });
    const scheduled = scheduleDay1(plan);
    const grocery = scheduled.find(isGroceryActivity);
    const dinner = scheduled.find(isDinnerMeal);
    expect(grocery).toBeDefined();
    expect(dinner).toBeDefined();
    expect(scheduled.indexOf(grocery!)).toBeLessThan(scheduled.indexOf(dinner!));
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });
});
