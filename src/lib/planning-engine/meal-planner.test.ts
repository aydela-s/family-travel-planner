import { describe, expect, it } from "vitest";
import { breakfastLabel } from "@/lib/planning-engine/meal-planner";
import { TripPlan } from "@/types/trip-plan";
import { CityRestaurant } from "@/config/city-restaurants";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-07-14",
    endDate: "2026-07-17",
    adults: 2,
    children: [16],
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

const cafe: CityRestaurant = {
  name: "Café Kitsuné Tuileries",
  lat: 48.86,
  lng: 2.33,
  meals: ["breakfast"],
  ageTags: ["tween", "teen"],
  dietary: ["vegetarian"],
  budgetStyles: ["balanced"],
  familyNote: "Coffee and pastries near the gardens.",
};

describe("breakfastLabel — FAM-26", () => {
  it("does not mention kid-friendly language for teens", () => {
    const { title, notes } = breakfastLabel(plan({ children: [16] }), "Marais", cafe);
    expect(`${title} ${notes}`.toLowerCase()).not.toMatch(/kid/);
    expect(title).toContain("Café Kitsuné Tuileries");
  });

  it("keeps takeaway copy age-neutral when there is no kitchen", () => {
    const { title, notes } = breakfastLabel(
      plan({ accommodationType: "airbnb_no_kitchen", children: [16] }),
      "Marais",
      cafe,
    );
    expect(title).toContain("Takeaway breakfast at");
    expect(notes.toLowerCase()).not.toMatch(/kid/);
  });
});
