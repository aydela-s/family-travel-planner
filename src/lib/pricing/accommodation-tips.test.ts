import { describe, expect, it } from "vitest";
import { accommodationPlanningTips } from "@/lib/pricing/accommodation";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-07-14",
    endDate: "2026-07-17",
    adults: 2,
    children: [8],
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

describe("accommodationPlanningTips — FAM-6", () => {
  it("does not suggest budget pastry tips for splurge trips", () => {
    const tips = accommodationPlanningTips(plan({ budgetStyle: "splurge" }), 1);
    expect(tips.join(" ").toLowerCase()).not.toMatch(/pastries|budget-smart/);
  });

  it("varies tips across days when landmark context differs", () => {
    const day1 = accommodationPlanningTips(plan(), 1, {
      landmarkNames: ["Louvre Museum"],
    });
    const day2 = accommodationPlanningTips(plan(), 2, {
      landmarkNames: ["Eiffel Tower"],
      cookingDinner: true,
    });
    expect(day1.join("|")).not.toBe(day2.join("|"));
  });
});
