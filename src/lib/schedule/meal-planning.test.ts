import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import {
  isDinnerMeal,
  MIN_LUNCH_DURATION_MIN,
  NAP_START_SLIP_MAX_MIN,
  rescheduleActivitiesWithMealAnchors,
  resolveNapStartAroundLunch,
} from "@/lib/schedule/meal-planning";
import {
  activitiesOverlap,
  defaultTravelMin,
  HIGH_INTENSITY_REST_BONUS_MIN,
  parseTimeToMinutes,
  TIME_SNAP_MINUTES,
} from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";
import { LandmarkIntensity } from "@/config/city-pricing";

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

describe("resolveNapStartAroundLunch", () => {
  it("keeps nap at preferred start when lunch can begin early enough", () => {
    expect(
      resolveNapStartAroundLunch({
        preferredNapStart: 13 * 60,
        lunchBeforeNap: true,
        travelMin: 15,
        lunchWindowMin: 12 * 60,
      }),
    ).toBe(13 * 60);
  });

  it("slips nap by at most 30 min when 11:45 conflicts with a 40-min lunch", () => {
    const start = resolveNapStartAroundLunch({
      preferredNapStart: 11 * 60 + 45,
      lunchBeforeNap: true,
      travelMin: 20,
      lunchWindowMin: 11 * 60 + 30,
    });
    expect(start).toBeGreaterThan(11 * 60 + 45);
    expect(start).toBeLessThanOrEqual(11 * 60 + 45 + NAP_START_SLIP_MAX_MIN);
    expect(start - (11 * 60) - MIN_LUNCH_DURATION_MIN).toBeGreaterThanOrEqual(20);
  });

  it("does not slip when lunch is after the nap", () => {
    expect(
      resolveNapStartAroundLunch({
        preferredNapStart: 11 * 60 + 45,
        lunchBeforeNap: false,
        travelMin: 20,
        lunchWindowMin: 11 * 60 + 30,
      }),
    ).toBe(11 * 60 + 45);
  });
});

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
      defaultTravelMin(plan) + TIME_SNAP_MINUTES,
    );
  });

  it("starts a typed 11:45-1:30 nap near 11:45 and keeps lunch ≥40 min", () => {
    // Oldest ≤7 → lunch window 11:30–12:00, so lunch sits before an 11:45 nap.
    const plan = balancedPlan([2, 5], { napSchedule: "11:45-1:30" });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const nap = scheduled.find((a) => a.type === "nap");
    const lunch = scheduled.find(
      (a) => a.type === "meal" && parseTimeToMinutes(a.time) < 16 * 60,
    );
    expect(nap).toBeDefined();
    expect(lunch).toBeDefined();
    const napStart = parseTimeToMinutes(nap!.time);
    expect(napStart).toBeGreaterThanOrEqual(11 * 60 + 45);
    expect(napStart).toBeLessThanOrEqual(11 * 60 + 45 + NAP_START_SLIP_MAX_MIN);
    expect(parseTimeToMinutes(nap!.endTime!)).toBeLessThanOrEqual(13 * 60 + 30);
    expect(nap!.title).toBe("Nap & Quiet Time");
    const lunchDur =
      parseTimeToMinutes(lunch!.endTime!) - parseTimeToMinutes(lunch!.time);
    expect(lunchDur).toBeGreaterThanOrEqual(MIN_LUNCH_DURATION_MIN);
    expect(parseTimeToMinutes(lunch!.endTime!)).toBeLessThanOrEqual(napStart);
  });

  it("fixRawDayActivities produces a valid day schedule", () => {
    const plan = balancedPlan([5, 10]);
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("keeps a buffer between grocery and cook-at-home dinner", () => {
    const plan = balancedPlan([5, 10], {
      accommodationType: "airbnb_with_kitchen",
      napSchedule: "No naps needed",
    });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const grocery = scheduled.find((a) => /grocery/i.test(a.title));
    const dinner = scheduled.find((a) => isDinnerMeal(a));
    expect(grocery).toBeDefined();
    expect(dinner).toBeDefined();
    const gap =
      parseTimeToMinutes(dinner!.time) - parseTimeToMinutes(grocery!.endTime!);
    expect(gap).toBeGreaterThanOrEqual(30);
  });
});

describe("high-intensity recovery rest — Phase 6", () => {
  type Raw = {
    time: string;
    title: string;
    type: ActivityType;
    landmarkIntensity?: LandmarkIntensity;
  };

  function dayWithMorningIntensity(intensity: LandmarkIntensity): Raw[] {
    return [
      { time: "08:00", title: "Breakfast", type: "meal" },
      {
        time: "09:00",
        title: "Morning landmark",
        type: "activity",
        landmarkIntensity: intensity,
      },
      { time: "12:00", title: "Lunch", type: "meal" },
      { time: "13:00", title: "Midday break", type: "rest" },
      { time: "14:30", title: "Afternoon landmark", type: "activity", landmarkIntensity: "low" },
      { time: "18:30", title: "Dinner", type: "meal" },
    ];
  }

  function restDurationMin(
    scheduled: { type: ActivityType; time: string; endTime: string }[],
  ): number {
    const rest = scheduled.find((a) => a.type === "rest");
    expect(rest).toBeDefined();
    return parseTimeToMinutes(rest!.endTime) - parseTimeToMinutes(rest!.time);
  }

  it("lengthens the next rest by 15 minutes after a high-intensity activity", () => {
    const plan = balancedPlan([8]);
    const high = rescheduleActivitiesWithMealAnchors(dayWithMorningIntensity("high"), plan);
    const medium = rescheduleActivitiesWithMealAnchors(dayWithMorningIntensity("medium"), plan);

    expect(restDurationMin(high)).toBe(restDurationMin(medium) + HIGH_INTENSITY_REST_BONUS_MIN);
  });

  it("lengthens the next nap by 15 minutes after a high-intensity activity", () => {
    const plan = balancedPlan([3], { napSchedule: "Early afternoon (1–3 PM)" });
    const base: Raw[] = [
      { time: "08:00", title: "Breakfast", type: "meal" },
      {
        time: "09:00",
        title: "Morning landmark",
        type: "activity",
        landmarkIntensity: "high",
      },
      { time: "12:00", title: "Lunch", type: "meal" },
      { time: "13:00", title: "Nap", type: "nap" },
      { time: "15:00", title: "Afternoon landmark", type: "activity", landmarkIntensity: "low" },
      { time: "18:30", title: "Dinner", type: "meal" },
    ];
    const lowMorning = base.map((a) =>
      a.title === "Morning landmark" ? { ...a, landmarkIntensity: "low" as const } : a,
    );

    const high = rescheduleActivitiesWithMealAnchors(base, plan);
    const low = rescheduleActivitiesWithMealAnchors(lowMorning, plan);
    const highNap = high.find((a) => a.type === "nap")!;
    const lowNap = low.find((a) => a.type === "nap")!;
    const highDur = parseTimeToMinutes(highNap.endTime) - parseTimeToMinutes(highNap.time);
    const lowDur = parseTimeToMinutes(lowNap.endTime) - parseTimeToMinutes(lowNap.time);

    expect(highDur).toBe(lowDur + HIGH_INTENSITY_REST_BONUS_MIN);
  });
});
