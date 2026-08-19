import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { childMealShare } from "@/lib/pricing/accommodation";
import {
  DEFAULT_FOOD_DELIVERY_FEES,
  estimateDeliveryLunchCost,
  estimateMealCosts,
  estimateMealPartyCostForActivity,
} from "@/lib/pricing/budget";
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

  const deliveryLunch: ItineraryActivity = {
    time: "12:30 PM",
    title: "Delivery lunch at your stay",
    type: "meal",
    slotKind: "lunch",
  };

  it("prices stay delivery as food + delivery fee + service fee + tip (FAM-82)", () => {
    const breakdown = estimateDeliveryLunchCost(deliveryLunch, city, plan);
    // Food: SD lunch $24 × restaurant tier × (1 adult + 4yo 0.4 + 8yo 0.6) = $48
    expect(breakdown.food).toBe(48);
    expect(breakdown.deliveryFee).toBe(DEFAULT_FOOD_DELIVERY_FEES.fee);
    expect(breakdown.serviceFee).toBe(DEFAULT_FOOD_DELIVERY_FEES.serviceFee);
    expect(breakdown.tip).toBe(7.2); // 15% of $48
    expect(breakdown.total).toBe(
      roundish(
        breakdown.food + breakdown.deliveryFee + breakdown.serviceFee + breakdown.tip,
      ),
    );
    expect(estimateMealCosts([deliveryLunch], city, plan)).toBe(breakdown.total);
  });

  it("does not bill delivery food as adult × headcount", () => {
    const breakdown = estimateDeliveryLunchCost(deliveryLunch, city, plan);
    const headcount = plan.adults + plan.children.length; // 3
    expect(breakdown.food).toBeLessThan(city.food.lunch * headcount);
    expect(breakdown.party.adults).toBe(city.food.lunch * plan.adults);
    expect(breakdown.party.children).toBe(
      city.food.lunch * (childMealShare(4) + childMealShare(8)),
    );
  });

  it("delivery total exceeds sit-down lunch by app fees + tip", () => {
    const delivery = estimateMealPartyCostForActivity(deliveryLunch, city, plan);
    const sitDown = estimateMealPartyCostForActivity(
      {
        time: "12:30 PM",
        title: "Lunch at Kono's Cafe",
        type: "meal",
        slotKind: "lunch",
      },
      city,
      plan,
    );
    expect(delivery.total).toBeGreaterThan(sitDown.total);
    expect(delivery.detail).toMatch(/delivery|service|tip/i);
  });
});

function roundish(n: number): number {
  return Math.round(n * 100) / 100;
}
