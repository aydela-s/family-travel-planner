import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import { INTEREST_CATEGORY_DEFAULTS } from "@/lib/schedule/interest-category-defaults";
import { rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function sdPacked(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    adults: 1,
    children: [4, 8],
    travelStyle: "packed",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "Vegetarian",
    naps: [],
    budgetStyle: "balanced",
    interests: [
      "Beaches & Waterfronts",
      "Playgrounds & Indoor Play",
      "Nature & Scenic Views",
      "Theme Parks",
    ],
    ...overrides,
  };
}

describe("packed San Diego schedule quality (FAM-70)", () => {
  it("omits midday rest on packed days without naps", () => {
    const kinds = buildDaySkeleton(sdPacked(), 1, 5).map((s) => s.kind);
    expect(kinds).not.toContain("midday_rest");
    expect(kinds).toContain("extra_activity");

    const balanced = buildDaySkeleton(sdPacked({ travelStyle: "balanced" }), 1, 5).map(
      (s) => s.kind,
    );
    expect(balanced).toContain("midday_rest");
  });

  it("fills the morning until lunch when hotel breakfast starts the day early", () => {
    const { raw, plan } = planTrip(sdPacked());
    const scheduled = rescheduleActivitiesWithMealAnchors(raw.days[0]!.activities, plan);
    const morning = scheduled.find((a) => a.slotKind === "morning_activity")!;
    const lunch = scheduled.find((a) => a.slotKind === "lunch")!;
    const morningEnd = parseTimeToMinutes(morning.endTime!);
    const lunchStart = parseTimeToMinutes(lunch.time);
    // Dead morning gap should be travel-sized, not ~2 hours.
    expect(lunchStart - morningEnd).toBeLessThanOrEqual(35);
    expect(validateDaySchedule(scheduled, plan)).toEqual([]);
  });

  it("schedules theme parks as half-day afternoon adventures, not short extras", () => {
    const { raw, plan } = planTrip(sdPacked());
    const themeActs = raw.days
      .flatMap((d) => d.activities)
      .filter((a) => a.interestTags?.includes("theme-parks"));
    for (const act of themeActs) {
      expect(act.slotKind).toBe("afternoon_activity");
    }

    for (const day of raw.days) {
      const scheduled = rescheduleActivitiesWithMealAnchors(day.activities, plan);
      const theme = scheduled.filter((a) => a.interestTags?.includes("theme-parks"));
      for (const act of theme) {
        const dur = parseTimeToMinutes(act.endTime!) - parseTimeToMinutes(act.time);
        expect(dur).toBeGreaterThanOrEqual(
          INTEREST_CATEGORY_DEFAULTS["theme-parks"].durationMin,
        );
      }
      if (theme.length > 0) {
        expect(scheduled.some((a) => a.slotKind === "extra_activity")).toBe(false);
        const lunch = scheduled.find((a) => a.slotKind === "lunch")!;
        const park = theme[0]!;
        const dinner = scheduled.find((a) => a.slotKind === "dinner")!;
        // Starts soon after lunch — no multi-hour idle gap.
        expect(parseTimeToMinutes(park.time) - parseTimeToMinutes(lunch.endTime!)).toBeLessThanOrEqual(
          35,
        );
        // Runs through until near dinner.
        expect(parseTimeToMinutes(dinner.time) - parseTimeToMinutes(park.endTime!)).toBeLessThanOrEqual(
          35,
        );
      }
      expect(validateDaySchedule(scheduled, plan)).toEqual([]);
    }
  });

  it("prefers unique primary stops across a 5-day packed trip", () => {
    const { raw } = planTrip(sdPacked());
    const primaryNames = raw.days.flatMap((d) =>
      d.activities
        .filter(
          (a) =>
            a.slotKind === "morning_activity" ||
            a.slotKind === "afternoon_activity" ||
            a.slotKind === "extra_activity",
        )
        .map((a) => a.title.replace(/^(Explore|Visit|Family time at)\s+/i, "").trim()),
    );
    const unique = new Set(primaryNames);
    // Soft target: most stops should be unique before forced reuse.
    expect(unique.size).toBeGreaterThanOrEqual(Math.min(primaryNames.length, 8));
  });
});
