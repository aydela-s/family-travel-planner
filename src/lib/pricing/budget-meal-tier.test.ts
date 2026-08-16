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
    // SD adult lunch $24 × picnic tier 0.4 = $9.60 per adult,
    // then 1 adult + a 4yo (0.4 share) + an 8yo (0.6 share) = 2.0 units.
    expect(cost).toBe(19.2);
  });

  it("charges a full restaurant lunch far more than the picnic tier", () => {
    const picnic = estimateMealCosts(
      [{ time: "12:30 PM", title: "Takeout lunch at your stay", type: "meal", slotKind: "lunch" }],
      city,
      plan,
    );
    const sitDown = estimateMealCosts(
      [{ time: "12:30 PM", title: "Lunch at Kono's Cafe", type: "meal", slotKind: "lunch" }],
      city,
      plan,
    );
    expect(sitDown).toBeGreaterThan(picnic * 1.5);
  });
});
