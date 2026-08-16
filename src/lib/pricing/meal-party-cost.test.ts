import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { childMealShare, estimateMealPartyCost } from "@/lib/pricing/accommodation";
import { applyMealActivityCosts, estimateMealPartyCostForActivity } from "@/lib/pricing/budget";
import type { ItineraryActivity } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function meal(time: string, title: string): ItineraryActivity {
  return { time, title, type: "meal", slotKind: title.toLowerCase().includes("breakfast") ? "breakfast" : title.toLowerCase().includes("dinner") ? "dinner" : "lunch" };
}

describe("meal cost by traveler composition", () => {
  it("charges children a share of the adult price based on age", () => {
    expect(childMealShare(1)).toBeLessThan(childMealShare(5));
    expect(childMealShare(5)).toBeLessThan(childMealShare(10));
    expect(childMealShare(10)).toBeLessThan(childMealShare(15));
    expect(childMealShare(15)).toBeLessThanOrEqual(1);
  });

  it("splits a party cost into adults and children", () => {
    const party = estimateMealPartyCost(30, plan());
    // 1 adult at $30, a 4yo at 40% and an 8yo at 60% = $30 + $30 of kids.
    expect(party.adults).toBe(30);
    expect(party.children).toBe(30);
    expect(party.total).toBe(60);
    expect(party.detail).toBe("1 adult 30 + 2 kids 30");
  });

  it("never bills 1 adult + 2 kids as three adults", () => {
    const family = estimateMealPartyCost(30, plan());
    const threeAdults = estimateMealPartyCost(30, plan({ adults: 3, children: [] }));
    expect(family.total).toBeLessThan(threeAdults.total);
  });

  it("keeps a 1 adult + 2 kids day realistic", () => {
    const trip = plan();
    const breakfast = estimateMealPartyCostForActivity(meal("08:00", "Breakfast near the bay"), city, trip);
    const lunch = estimateMealPartyCostForActivity(meal("12:30", "Lunch at Kono's Cafe"), city, trip);
    const dinner = estimateMealPartyCostForActivity(meal("18:00", "Dinner at Hodad's"), city, trip);

    expect(breakfast.total).toBeLessThan(lunch.total);
    expect(lunch.total).toBeLessThan(dinner.total);
    // The old model produced $26 / $81 / $128 for this family.
    expect(lunch.total).toBeLessThan(60);
    expect(dinner.total).toBeLessThan(100);
    expect(breakfast.total + lunch.total + dinner.total).toBeLessThan(180);
  });

  it("scales with the party, not a flat per-head estimate", () => {
    const single = estimateMealPartyCostForActivity(meal("18:00", "Dinner at Hodad's"), city, plan({ adults: 1, children: [] }));
    const withKids = estimateMealPartyCostForActivity(meal("18:00", "Dinner at Hodad's"), city, plan());
    expect(withKids.total).toBeGreaterThan(single.total);
    expect(withKids.adults).toBe(single.total);
  });

  it("explains the split on the activity itself", () => {
    const [priced] = applyMealActivityCosts([meal("18:00", "Dinner at Hodad's")], city, plan());
    expect(priced!.activityCost).toBeGreaterThan(0);
    expect(priced!.notes).toContain("1 adult");
    expect(priced!.notes).toContain("2 kids");
  });
});
