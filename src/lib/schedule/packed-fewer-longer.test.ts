import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { buildDayIntents } from "@/lib/planning-engine/skeleton-builder";
import {
  applyPackedFewerLonger,
  isGroceryActivity,
  rescheduleActivitiesWithMealAnchors,
} from "@/lib/schedule/meal-planning";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import { PACKED_LONGER_ACTIVITY_MIN } from "@/lib/schedule/travel-style";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function packedPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [10, 14],
    travelStyle: "packed",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function activityDurationMin(a: { time: string; endTime?: string }): number {
  return parseTimeToMinutes(a.endTime!) - parseTimeToMinutes(a.time);
}

describe("packed fewer/longer activities — P1", () => {
  it("lengthens remaining activities when the optional extra is absent", () => {
    const plan = packedPlan();
    const scheduled = applyPackedFewerLonger(
      [
        {
          time: "09:00",
          endTime: "10:15",
          title: "Morning",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
        },
        {
          time: "10:35",
          endTime: "11:35",
          title: "Lunch",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "11:55",
          endTime: "13:10",
          title: "Afternoon",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
        },
      ],
      plan,
    );

    const morning = scheduled.find((a) => a.slotKind === "morning_activity")!;
    const afternoon = scheduled.find((a) => a.slotKind === "afternoon_activity")!;
    expect(activityDurationMin(morning)).toBe(PACKED_LONGER_ACTIVITY_MIN);
    expect(activityDurationMin(afternoon)).toBe(PACKED_LONGER_ACTIVITY_MIN);
    expect(parseTimeToMinutes(afternoon.time)).toBeGreaterThanOrEqual(
      parseTimeToMinutes(scheduled[1].endTime) + 20 - 15,
    );
  });

  it("keeps 75-minute activities when the packed extra stop fits", () => {
    const plan = packedPlan({ children: [12, 15] });
    const { raw } = planTrip(plan);
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);

    expect(scheduled.some((a) => a.slotKind === "extra_activity")).toBe(true);
    const activities = scheduled.filter(
      (a) => a.type === "activity" && !isGroceryActivity(a),
    );
    expect(activities.length).toBeGreaterThanOrEqual(3);
    expect(activities.every((a) => activityDurationMin(a) <= 80)).toBe(true);
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("tries the packed extra after naps, and lengthens only when it cannot fit", () => {
    const plan = packedPlan({
      children: [2, 5],
      napSchedule: "Early afternoon (1–3 PM)",
    });
    // Skeleton still offers the extra (FAM-5).
    const intents = buildDayIntents(plan, 1, 2);
    expect(intents.some((i) => i.kind === "extra_activity")).toBe(true);

    const { raw } = planTrip(plan);
    expect(raw.days[0].activities.some((a) => a.type === "nap")).toBe(true);

    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0].activities, plan);
    const hasExtra = scheduled.some((a) => a.slotKind === "extra_activity");
    const activities = scheduled.filter(
      (a) => a.type === "activity" && !isGroceryActivity(a),
    );
    if (hasExtra) {
      expect(activities.length).toBeGreaterThanOrEqual(3);
    } else {
      expect(activities.length).toBe(2);
      for (const activity of activities) {
        expect(activityDurationMin(activity)).toBeGreaterThanOrEqual(PACKED_LONGER_ACTIVITY_MIN);
      }
    }
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("makes packed+nap days differ from balanced when the extra stop fits", () => {
    const shared = {
      children: [8],
      napSchedule: "12-2",
      accommodationType: "hotel_no_breakfast" as const,
    };
    const balanced = packedPlan({ ...shared, travelStyle: "balanced" });
    const packed = packedPlan({ ...shared, travelStyle: "packed" });
    const balancedSched = rescheduleActivitiesWithMealAnchors(
      planTrip(balanced).raw.days[0].activities,
      balanced,
    );
    const packedSched = rescheduleActivitiesWithMealAnchors(
      planTrip(packed).raw.days[0].activities,
      packed,
    );
    const balancedCount = balancedSched.filter(
      (a) => a.type === "activity" && !isGroceryActivity(a),
    ).length;
    const packedCount = packedSched.filter(
      (a) => a.type === "activity" && !isGroceryActivity(a),
    ).length;
    expect(packedCount).toBeGreaterThan(balancedCount);
    expect(packedSched.some((a) => a.slotKind === "extra_activity")).toBe(true);
    expect(validateDaySchedule(balancedSched, balanced)).toEqual([]);
    expect(validateDaySchedule(packedSched, packed)).toEqual([]);
  });

  it("does not lengthen midday breaks when packing fewer/longer stops", () => {
    const plan = packedPlan({ children: [10] });
    const scheduled = applyPackedFewerLonger(
      [
        {
          time: "13:15",
          endTime: "13:40",
          title: "Break at Park",
          type: "activity" as const,
          slotKind: "midday_rest" as const,
        },
        {
          time: "14:00",
          endTime: "15:15",
          title: "Afternoon",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
        },
      ],
      plan,
    );

    const brk = scheduled.find((a) => a.slotKind === "midday_rest")!;
    const afternoon = scheduled.find((a) => a.slotKind === "afternoon_activity")!;
    expect(activityDurationMin(brk)).toBe(25);
    expect(activityDurationMin(afternoon)).toBe(PACKED_LONGER_ACTIVITY_MIN);
  });

  it("keeps the last packed activity from overlapping dinner after enrich travel times", async () => {
    const { enrichItinerary } = await import("@/lib/enrich-itinerary");
    const plan = packedPlan({
      destination: "Paris",
      children: [3, 5],
      napSchedule: "No naps needed",
      transportationType: "taxis",
      accommodationType: "hotel_no_breakfast",
    });
    const { raw, plan: working } = planTrip(plan);
    const itinerary = await enrichItinerary(raw, working);

    for (const day of itinerary.days) {
      expect(validateDaySchedule(day.activities, plan)).toEqual([]);
      for (let i = 1; i < day.activities.length; i++) {
        const prev = day.activities[i - 1];
        const cur = day.activities[i];
        expect(parseTimeToMinutes(cur.time)).toBeGreaterThanOrEqual(
          parseTimeToMinutes(prev.endTime ?? prev.time),
        );
      }
    }
  });
});
