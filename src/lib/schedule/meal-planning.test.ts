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
  HIGH_INTENSITY_REST_BONUS_MIN,
  parseTimeToMinutes,
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
    naps: [],
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

  it("keeps a noon nap when early lunch flex lets a 40-min meal fit", () => {
    // lunchFloor = max(11:00, 11:30-45) = 11:00; need start 11:05 → no slip needed.
    const start = resolveNapStartAroundLunch({
      preferredNapStart: 12 * 60,
      lunchBeforeNap: true,
      travelMin: 15,
      lunchWindowMin: 11 * 60 + 30,
    });
    expect(start).toBe(12 * 60);
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
      (a) => a.slotKind === "lunch" || (a.type === "meal" && /\blunch\b/i.test(a.title)),
    );
    expect(lunch).toBeDefined();

    const lunchIdx = scheduled.indexOf(lunch!);
    const next = scheduled.slice(lunchIdx + 1).find(
      (a) => a.type !== "rest" && a.slotKind !== "return_home" && a.slotKind !== "afternoon_rest",
    );
    expect(next).toBeDefined();
    const gap = parseTimeToMinutes(next!.time) - parseTimeToMinutes(lunch!.endTime!);
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

  it("leaves recovery time after a nap instead of starting the next outing immediately", () => {
    const plan = balancedPlan([2, 5], { naps: [{ startTime: "1:00 PM", endTime: "3:00 PM", type: "regular" }] });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const nap = scheduled.find((a) => a.type === "nap");
    const afterNap = scheduled.find(
      (a) =>
        a.slotKind === "afternoon_activity" &&
        parseTimeToMinutes(a.time) > parseTimeToMinutes(nap!.endTime!),
    );

    expect(nap).toBeDefined();
    if (afterNap) {
      expect(parseTimeToMinutes(afterNap.time) - parseTimeToMinutes(nap!.endTime!)).toBeGreaterThanOrEqual(
        60,
      );
    } else {
      const napEnd = parseTimeToMinutes(nap!.endTime!);
      const dinner = scheduled.find((a) => a.slotKind === "dinner");
      expect(dinner).toBeDefined();
      expect(parseTimeToMinutes(dinner!.time) - napEnd).toBeGreaterThan(0);
    }
  });

  it("starts a typed 11:45-1:30 nap near 11:45 and keeps lunch ≥40 min", () => {
    // Oldest ≤7 → lunch window 11:30–12:00, so lunch sits before an 11:45 nap.
    const plan = balancedPlan([2, 5], { naps: [{ startTime: "11:45 AM", endTime: "1:30 PM", type: "regular" }] });
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
    expect(parseTimeToMinutes(nap!.endTime!)).toBeLessThanOrEqual(
      13 * 60 + 30 + HIGH_INTENSITY_REST_BONUS_MIN,
    );
    expect(nap!.title).toBe("Nap");
    const lunchDur =
      parseTimeToMinutes(lunch!.endTime!) - parseTimeToMinutes(lunch!.time);
    expect(lunchDur).toBeGreaterThanOrEqual(MIN_LUNCH_DURATION_MIN);
    expect(parseTimeToMinutes(lunch!.endTime!)).toBeLessThanOrEqual(napStart);
  });

  it("extends nap end time when the typed window is lengthened (12:30-2:30)", () => {
    const plan = balancedPlan([2, 5], { naps: [{ startTime: "12:30 PM", endTime: "2:30 PM", type: "regular" }] });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const nap = scheduled.find((a) => a.type === "nap");
    expect(nap).toBeDefined();
    const napStart = parseTimeToMinutes(nap!.time);
    const napEnd = parseTimeToMinutes(nap!.endTime!);
    expect(napStart).toBeGreaterThanOrEqual(12 * 60 + 30);
    // May slip later for lunch; always finish by the typed window end.
    expect(napEnd).toBeLessThanOrEqual(14 * 60 + 30);
    expect(napEnd - napStart).toBeGreaterThanOrEqual(90);
  });

  it("keeps lunch from overlapping a 12-2 nap on balanced days", () => {
    const plan = balancedPlan([3], { naps: [{ startTime: "12:00 PM", endTime: "2:00 PM", type: "regular" }] });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const lunch = scheduled.find(
      (a) => a.type === "meal" && parseTimeToMinutes(a.time) < 16 * 60,
    );
    const nap = scheduled.find((a) => a.type === "nap");
    expect(lunch).toBeDefined();
    expect(nap).toBeDefined();
    expect(parseTimeToMinutes(lunch!.endTime!)).toBeLessThanOrEqual(
      parseTimeToMinutes(nap!.time),
    );
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("never lets lunch overlap a long morning activity before a noon nap (Funbox regression)", () => {
    const plan = balancedPlan([3, 5], {
      destination: "San Diego",
      naps: [{ startTime: "12:00 PM", endTime: "1:30 PM", type: "regular" }],
      interests: ["Indoor & Outdoor Play"],
      transportationType: "taxis",
    });
    // Skeleton-style times that previously produced 10:00–11:30 activity overlapping 11:00 lunch.
    const activities = [
      {
        time: "08:00",
        title: "Breakfast near Funbox (Plaza Bonita, National City)",
        type: "meal" as ActivityType,
        slotKind: "breakfast" as const,
      },
      {
        time: "10:00",
        title: "Family time at Funbox (Plaza Bonita, National City)",
        type: "activity" as ActivityType,
        slotKind: "morning_activity" as const,
        landmarkIntensity: "high" as LandmarkIntensity,
      },
      {
        time: "11:00",
        title: "Lunch near Funbox (Plaza Bonita, National City)",
        type: "meal" as ActivityType,
        slotKind: "lunch" as const,
      },
      {
        time: "12:00",
        title: "Nap",
        type: "nap" as ActivityType,
      },
      {
        time: "15:30",
        title: "Explore Mission Bay Park",
        type: "activity" as ActivityType,
        slotKind: "afternoon_activity" as const,
      },
      {
        time: "17:30",
        title: "Dinner at Evolution Fast Food",
        type: "meal" as ActivityType,
        slotKind: "dinner" as const,
      },
    ];
    const scheduled = rescheduleActivitiesWithMealAnchors(activities, plan);
    expect(activitiesOverlap(scheduled)).toBe(false);
    for (let i = 1; i < scheduled.length; i++) {
      expect(parseTimeToMinutes(scheduled[i]!.time)).toBeGreaterThanOrEqual(
        parseTimeToMinutes(scheduled[i - 1]!.endTime!),
      );
    }
    const morning = scheduled.find((a) => /Funbox/i.test(a.title) && a.type === "activity")!;
    const lunch = scheduled.find((a) => /lunch|picnic/i.test(a.title))!;
    expect(parseTimeToMinutes(lunch.time)).toBeGreaterThanOrEqual(
      parseTimeToMinutes(morning.endTime!),
    );
    expect(validateDaySchedule(scheduled, plan).filter((v) => v.code === "overlap" || v.code === "time_travel")).toEqual(
      [],
    );
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
      naps: [],
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
    const plan = balancedPlan([3], { naps: [{ startTime: "1:00 PM", endTime: "3:00 PM", type: "regular" }] });
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

describe("isDinnerMeal — landmark names containing Dinner", () => {
  it("does not treat breakfast/lunch near Medieval Times Dinner as dinner", () => {
    expect(
      isDinnerMeal({
        time: "08:00",
        title: "Breakfast near Medieval Times Dinner & Tournament",
        type: "meal",
        slotKind: "breakfast",
      }),
    ).toBe(false);
    expect(
      isDinnerMeal({
        time: "12:00",
        title: "Lunch near Medieval Times Dinner & Tournament",
        type: "meal",
        slotKind: "lunch",
      }),
    ).toBe(false);
    expect(
      isDinnerMeal({
        time: "17:00",
        title: "Dinner near Medieval Times Dinner & Tournament",
        type: "meal",
        slotKind: "dinner",
      }),
    ).toBe(true);
  });

  it("keeps distinct meal times when venue name includes Dinner", () => {
    const plan = balancedPlan([3, 6]);
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "08:00",
          title: "Breakfast near Medieval Times Dinner & Tournament",
          type: "meal",
          slotKind: "breakfast",
        },
        {
          time: "10:00",
          title: "Family time at Medieval Times Dinner & Tournament",
          type: "activity",
        },
        {
          time: "12:00",
          title: "Lunch near Medieval Times Dinner & Tournament",
          type: "meal",
          slotKind: "lunch",
        },
        {
          time: "17:00",
          title: "Dinner near Medieval Times Dinner & Tournament",
          type: "meal",
          slotKind: "dinner",
        },
      ],
      plan,
    );

    const breakfast = scheduled.find((a) => a.slotKind === "breakfast")!;
    const lunch = scheduled.find((a) => a.slotKind === "lunch")!;
    const dinner = scheduled.find((a) => a.slotKind === "dinner")!;
    expect(parseTimeToMinutes(breakfast.time)).toBeLessThan(11 * 60);
    expect(parseTimeToMinutes(lunch.time)).toBeGreaterThanOrEqual(11 * 60);
    expect(parseTimeToMinutes(lunch.time)).toBeLessThan(16 * 60);
    expect(parseTimeToMinutes(dinner.time)).toBeGreaterThanOrEqual(17 * 60);
    expect(breakfast.time).not.toBe(dinner.time);
    expect(lunch.time).not.toBe(dinner.time);
  });
});

describe("breakfast taxi timing and dinner length", () => {
  it("starts breakfast so it ends when the first activity opens, not at 8:00", () => {
    const plan = balancedPlan([4, 6], { transportationType: "taxis" });
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "08:00",
          title: "Breakfast near Kids Empire",
          type: "meal" as const,
          slotKind: "breakfast" as const,
        },
        {
          time: "10:00",
          title: "Family time at Kids Empire",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["indoor-play"],
        },
        {
          time: "12:00",
          title: "Lunch near Kids Empire",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan,
    );
    const breakfast = scheduled.find((a) => a.slotKind === "breakfast")!;
    const morning = scheduled.find((a) => a.slotKind === "morning_activity")!;
    expect(parseTimeToMinutes(breakfast.time)).toBeGreaterThanOrEqual(9 * 60);
    expect(parseTimeToMinutes(breakfast.time)).toBeLessThan(10 * 60);
    expect(parseTimeToMinutes(morning.time)).toBeGreaterThanOrEqual(10 * 60);
    expect(parseTimeToMinutes(morning.endTime!) - parseTimeToMinutes(morning.time)).toBeGreaterThanOrEqual(
      90,
    );
  });

  it("keeps dinner at about an hour even when the afternoon runs late", () => {
    const plan = balancedPlan([4, 6]);
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "10:00",
          title: "Family time at the mall",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["shopping"],
        },
        {
          time: "12:00",
          title: "Lunch near the mall",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "14:00",
          title: "Family time at the water park",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["beaches"],
        },
        {
          time: "18:00",
          title: "Dinner at a restaurant",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      plan,
    );
    const dinner = scheduled.find((a) => a.slotKind === "dinner")!;
    expect(parseTimeToMinutes(dinner.endTime!) - parseTimeToMinutes(dinner.time)).toBeGreaterThanOrEqual(
      60,
    );
  });
});
