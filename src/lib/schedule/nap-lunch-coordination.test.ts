import { describe, expect, it } from "vitest";
import { lunchLabel, napOverlapsLunchWindow } from "@/lib/planning-engine/meal-planner";
import { rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    adults: 2,
    children: [3, 5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    naps: [{ startTime: "12:00 PM", endTime: "1:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("nap + lunch coordination", () => {
  it("detects nap overlapping the lunch window", () => {
    expect(napOverlapsLunchWindow(plan())).toBe(true);
    expect(
      napOverlapsLunchWindow(
        plan({ naps: [{ startTime: "2:30 PM", endTime: "4:00 PM", type: "regular" }] }),
      ),
    ).toBe(false);
  });

  it("suggests delivery at the stay when nap overlaps lunch", () => {
    const meal = lunchLabel(plan(), "Belmont Park");
    expect(meal.title).toBe("Delivery lunch at your stay");
    expect(meal.title.toLowerCase()).not.toMatch(/takeout/);
    expect(meal.notes.toLowerCase()).toMatch(/nap/);
    expect(meal.notes.toLowerCase()).toMatch(/delivery/);
    expect(meal.notes.toLowerCase()).not.toMatch(/takeout|grab/);
  });

  it("schedules delivery lunch 1 hour before nap", () => {
    const trip = plan({
      children: [4],
      naps: [{ startTime: "12:00 PM", endTime: "1:00 PM", type: "regular" }],
    });
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "09:00",
          title: "Explore Balboa Park",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
        },
        {
          time: "12:00",
          title: "Delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:00",
          title: "Nap & Quiet Time",
          type: "nap" as const,
        },
        {
          time: "18:00",
          title: "Dinner at Cucina Urbana",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      trip,
      [20, 0, 20],
    );

    const lunch = scheduled.find((a) => /delivery lunch at your stay/i.test(a.title))!;
    const nap = scheduled.find((a) => a.type === "nap")!;
    expect(parseTimeToMinutes(lunch.time)).toBe(parseTimeToMinutes(nap.time) - 60);
  });

  it("keeps nap end inside the typed window and rewrites the downtime note", () => {
    const trip = plan({
      children: [4],
      naps: [{ startTime: "12:00 PM", endTime: "1:00 PM", type: "regular" }],
    });
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "09:00",
          title: "Explore Balboa Park",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
        },
        {
          time: "12:00",
          title: "Delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:00",
          title: "Nap & Quiet Time",
          type: "nap" as const,
          notes: "Protected downtime 12:00 PM–1:00 PM.",
        },
        {
          time: "18:00",
          title: "Dinner at Cucina Urbana",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      trip,
      [20, 20, 20],
    );

    const nap = scheduled.find((a) => a.type === "nap")!;
    const start = parseTimeToMinutes(nap.time);
    const end = parseTimeToMinutes(nap.endTime!);
    expect(end).toBeLessThanOrEqual(13 * 60);
    expect(end - start).toBeLessThanOrEqual(60);
    expect(end - start).toBeGreaterThanOrEqual(20);
    expect(nap.notes).toBeUndefined();
  });

  it("schedules nap at the typed window without protected-downtime notes", () => {
    const trip = plan({
      children: [4],
      naps: [{ startTime: "12:00 PM", endTime: "1:30 PM", type: "regular" }],
    });
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "09:00",
          title: "Explore Belmont Park",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
        },
        {
          time: "12:00",
          title: "Delivery lunch at your stay",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "12:00",
          title: "Nap & Quiet Time",
          type: "nap" as const,
          notes: "Protected downtime 12:00 PM–1:30 PM.",
        },
        {
          time: "18:00",
          title: "Dinner near the waterfront",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      trip,
      [20, 20, 20],
    );

    const nap = scheduled.find((a) => a.type === "nap")!;
    expect(nap.notes).toBeUndefined();
    expect(parseTimeToMinutes(nap.time)).toBe(12 * 60);
  });
});
