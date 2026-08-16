import { describe, expect, it } from "vitest";
import { INTEREST_CATEGORY_DEFAULTS } from "@/lib/schedule/interest-category-defaults";
import { rescheduleActivitiesWithMealAnchors } from "@/lib/schedule/meal-planning";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function plan(): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    adults: 1,
    children: [4, 8],
    travelStyle: "packed",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "Vegetarian",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Theme Parks", "Playgrounds & Indoor Play"],
  };
}

describe("theme-park afternoon fills lunch→dinner (FAM-70)", () => {
  it("starts Belmont right after lunch and runs until dinner with no long gap", () => {
    const trip = plan();
    const scheduled = rescheduleActivitiesWithMealAnchors(
      [
        {
          time: "08:30",
          title: "Explore Waterfront Park Playground",
          type: "activity" as const,
          slotKind: "morning_activity" as const,
          interestTags: ["playgrounds" as const],
        },
        {
          time: "12:00",
          title: "Lunch near Belmont Park",
          type: "meal" as const,
          slotKind: "lunch" as const,
        },
        {
          time: "15:30",
          title: "Explore Belmont Park",
          type: "activity" as const,
          slotKind: "afternoon_activity" as const,
          interestTags: ["theme-parks" as const, "beaches" as const],
          landmarkIntensity: "high" as const,
        },
        {
          time: "18:00",
          title: "Dinner at Evolution Fast Food",
          type: "meal" as const,
          slotKind: "dinner" as const,
        },
      ],
      trip,
      [15, 15, 15],
    );

    const lunch = scheduled.find((a) => a.slotKind === "lunch")!;
    const belmont = scheduled.find(
      (a) => a.slotKind === "afternoon_activity" && /Belmont/i.test(a.title),
    )!;
    const dinner = scheduled.find((a) => a.slotKind === "dinner")!;

    expect(parseTimeToMinutes(belmont.time) - parseTimeToMinutes(lunch.endTime!)).toBeLessThanOrEqual(
      20,
    );
    expect(parseTimeToMinutes(dinner.time) - parseTimeToMinutes(belmont.endTime!)).toBeLessThanOrEqual(
      20,
    );
    const dur = parseTimeToMinutes(belmont.endTime!) - parseTimeToMinutes(belmont.time);
    expect(dur).toBeGreaterThanOrEqual(INTEREST_CATEGORY_DEFAULTS["theme-parks"].durationMin);
  });
});
