import { describe, expect, it } from "vitest";
import { buildDayIntents } from "@/lib/planning-engine/skeleton-builder";
import {
  isOptionalActivity,
  isOptionalSlotKind,
  priorityForSlotKind,
} from "@/lib/planning-engine/day-intent";
import { planTrip } from "@/lib/planning-engine";
import { dinnerTimeWindow } from "@/lib/planning-engine/meal-timing";
import { isDinnerMeal, rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
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

describe("day intent priorities", () => {
  it("marks evening stroll, extra activity, and afternoon rest as optional", () => {
    expect(isOptionalSlotKind("evening_rest")).toBe(true);
    expect(isOptionalSlotKind("extra_activity")).toBe(true);
    expect(isOptionalSlotKind("afternoon_rest")).toBe(true);
  });

  it("keeps meals and main activities as core", () => {
    expect(priorityForSlotKind("morning_activity")).toBe("core");
    expect(priorityForSlotKind("lunch")).toBe("core");
    expect(priorityForSlotKind("afternoon_activity")).toBe("core");
    expect(priorityForSlotKind("dinner")).toBe("core");
  });

  it("buildDayIntents assigns priority on every slot", () => {
    const intents = buildDayIntents(basePlan({ travelStyle: "packed" }), 1, 2);
    expect(intents.length).toBeGreaterThan(0);
    expect(intents.every((i) => i.priority === "core" || i.priority === "optional")).toBe(true);
    expect(intents.find((i) => i.kind === "extra_activity")?.priority).toBe("optional");
  });

  it("tags filled skeleton activities with slotKind", () => {
    const { raw } = planTrip(basePlan({ travelStyle: "packed" }));
    const kinds = raw.days[0].activities.map((a) => a.slotKind).filter(Boolean);
    expect(kinds).toContain("morning_activity");
    expect(kinds).toContain("lunch");
    expect(kinds).toContain("extra_activity");
  });

  it("uses slotKind for optional detection instead of title regex alone", () => {
    expect(
      isOptionalActivity({
        title: "Bonus museum stop",
        type: "activity",
        slotKind: "extra_activity",
      }),
    ).toBe(true);
    expect(
      isOptionalActivity({
        title: "Main afternoon visit",
        type: "activity",
        slotKind: "afternoon_activity",
      }),
    ).toBe(false);
  });
});

describe("optional intent scheduling", () => {
  it("drops optional intents when dinner window is too tight", () => {
    const plan = basePlan({
      children: [5, 10],
      accommodationType: "hotel_no_breakfast",
      transportationType: "walking",
    });

    const activities = [
      { time: "08:30", title: "Breakfast", type: "meal" as const, slotKind: "breakfast" as const },
      { time: "10:00", title: "Morning visit", type: "activity" as const, slotKind: "morning_activity" as const },
      { time: "12:00", title: "Lunch", type: "meal" as const, slotKind: "lunch" as const },
      { time: "14:00", title: "Afternoon visit", type: "activity" as const, slotKind: "afternoon_activity" as const },
      { time: "15:00", title: "Extra stop", type: "activity" as const, slotKind: "extra_activity" as const },
      { time: "16:00", title: "Free time", type: "rest" as const, slotKind: "afternoon_rest" as const },
      { time: "17:00", title: "Evening stroll near river", type: "rest" as const, slotKind: "evening_rest" as const },
      { time: "18:00", title: "Dinner out", type: "meal" as const, slotKind: "dinner" as const, notes: "dinner" },
    ];

    const scheduled = rescheduleActivitiesWithMealAnchors(activities, plan);
    const optionalKept = scheduled.filter((a) => isOptionalActivity(a));

    expect(optionalKept.length).toBeLessThan(3);
    expect(scheduled.find((a) => a.slotKind === "morning_activity")).toBeDefined();
    expect(scheduled.find((a) => a.slotKind === "lunch")).toBeDefined();
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);

    const dinner = scheduled.find(isDinnerMeal);
    expect(dinner).toBeDefined();
    expect(parseTimeToMinutes(dinner!.time)).toBeGreaterThanOrEqual(dinnerTimeWindow(plan).minMin);
  });

  it("keeps optional extra activity when the packed day has room", () => {
    const plan = basePlan({
      children: [12, 15],
      travelStyle: "packed",
      accommodationType: "hotel_no_breakfast",
    });

    const { raw } = planTrip(plan);
    expect(raw.days[0].activities.some((a) => a.slotKind === "extra_activity")).toBe(true);

    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    expect(scheduled.some((a) => a.slotKind === "extra_activity")).toBe(true);
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });
});
