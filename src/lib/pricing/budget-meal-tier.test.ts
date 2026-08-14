import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { estimateMealCosts } from "@/lib/pricing/budget";
import type { ItineraryActivity } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

describe("estimateMealCosts meal tiers", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  const plan: TripPlan = {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "vegan",
    budgetStyle: "balanced",
    interests: [],
  };

  it("prices nap-window takeout lunch at stay as picnic, not full restaurant", () => {
    const activities: ItineraryActivity[] = [
      {
        time: "12:30 PM",
        title: "Takeout or delivery lunch at your stay",
        type: "meal",
        slotKind: "lunch",
      },
    ];

    const cost = estimateMealCosts(activities, city, plan);
    // SD lunch base $55 × picnic tier 0.4 × 2.0 family meal units
    expect(cost).toBe(44);
  });
});
