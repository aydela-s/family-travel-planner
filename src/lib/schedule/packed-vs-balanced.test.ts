import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import { rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import { packedLongerDurationForTags } from "@/lib/schedule/interest-category-defaults";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function plan(style: "balanced" | "packed", overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-07-25",
    endDate: "2026-07-28",
    adults: 1,
    children: [3, 5],
    travelStyle: style,
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [{ startTime: "12:00 PM", endTime: "1:30 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Playgrounds & Indoor Play", "Nature & Scenic Views"],
    ...overrides,
  };
}

function realActivitySlots<
  T extends { type: string; slotKind?: string; interestTags?: import("@/config/city-pricing").LandmarkInterestTag[] },
>(activities: T[]) {
  return activities.filter(
    (a) =>
      a.type === "activity" &&
      (a.slotKind === "morning_activity" ||
        a.slotKind === "afternoon_activity" ||
        a.slotKind === "extra_activity"),
  );
}

describe("packed vs balanced schedules (FAM-5)", () => {
  it("keeps a third activity on packed days with young kids + nap", () => {
    const balancedRaw = planTrip(plan("balanced")).raw.days[0]!.activities;
    const packedResult = planTrip(plan("packed"));
    const packedRaw = packedResult.raw.days[0]!.activities;

    expect(buildDaySkeleton(plan("packed"), 1, 4).some((s) => s.kind === "extra_activity")).toBe(
      true,
    );
    expect(packedRaw.some((a) => a.slotKind === "extra_activity")).toBe(true);
    expect(realActivitySlots(packedRaw).length).toBeGreaterThan(realActivitySlots(balancedRaw).length);

    const packedScheduled = rescheduleActivitiesWithMealAnchors(packedRaw, packedResult.plan);
    expect(packedScheduled.some((a) => a.slotKind === "extra_activity")).toBe(true);
    expect(validateDaySchedule(packedScheduled, packedResult.plan)).toEqual([]);
  });

  it("keeps three stops on packed days without naps", () => {
    const packedResult = planTrip(plan("packed", { naps: [], children: [10, 12] }));
    const packedRaw = packedResult.raw.days[0]!.activities;
    expect(packedRaw.filter((a) => a.slotKind === "extra_activity")).toHaveLength(1);
    expect(realActivitySlots(packedRaw).length).toBeGreaterThanOrEqual(3);
    const scheduled = rescheduleActivitiesWithMealAnchors(packedRaw, packedResult.plan);
    expect(validateDaySchedule(scheduled, packedResult.plan)).toEqual([]);
  });

  it("lengthens remaining stops to packed adventure length when extra cannot fit", () => {
    const packedResult = planTrip(
      plan("packed", {
        naps: [{ startTime: "11:30 AM", endTime: "3:30 PM", type: "regular" }],
        children: [2],
      }),
    );
    const scheduled = rescheduleActivitiesWithMealAnchors(
      packedResult.raw.days[0]!.activities,
      packedResult.plan,
    );
    if (!scheduled.some((a) => a.slotKind === "extra_activity")) {
      const acts = realActivitySlots(scheduled);
      expect(acts.length).toBeGreaterThanOrEqual(1);
      const longest = Math.max(
        ...acts.map((a) => parseTimeToMinutes(a.endTime!) - parseTimeToMinutes(a.time)),
      );
      const minExpected = Math.min(
        ...acts.map((a) => packedLongerDurationForTags(a.interestTags)),
      );
      expect(longest).toBeGreaterThanOrEqual(Math.min(minExpected, 90));
    }
    expect(validateDaySchedule(scheduled, packedResult.plan)).toEqual([]);
  });
});
