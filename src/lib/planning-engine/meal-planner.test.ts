import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { breakfastLabel, shouldCookDinnerAtHome } from "@/lib/planning-engine/meal-planner";
import { TripPlan } from "@/types/trip-plan";
import { CityRestaurant } from "@/config/city-restaurants";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-09-15",
    endDate: "2026-09-17",
    adults: 2,
    children: [16],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
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
    const { title, notes } = breakfastLabel(
      plan({ children: [16], budgetStyle: "splurge" }),
      "Marais",
      cafe,
    );
    expect(`${title} ${notes}`.toLowerCase()).not.toMatch(/kid/);
    expect(title).toContain("Café Kitsuné Tuileries");
  });

  it("keeps takeaway copy age-neutral when there is no kitchen", () => {
    const { title, notes } = breakfastLabel(
      plan({
        accommodationType: "airbnb_no_kitchen",
        children: [16],
        budgetStyle: "splurge",
      }),
      "Marais",
      cafe,
    );
    expect(title).toContain("Takeaway breakfast at");
    expect(notes.toLowerCase()).not.toMatch(/kid/);
  });

  // Title stays short; the bakery/café intent belongs in the notes, not the heading.
  it("keeps balanced breakfast generic instead of naming a restaurant", () => {
    const { title, notes } = breakfastLabel(plan({ budgetStyle: "balanced" }), "Marais", cafe);
    expect(title).toBe("Breakfast near Marais");
    expect(title).not.toContain("Café Kitsuné");
    expect(notes.toLowerCase()).toMatch(/bakery|café|pastries/);
  });
});

describe("shouldCookDinnerAtHome — splurge vs kitchen", () => {
  it("cooks at home every night for balanced kitchen stays (FAM-74)", () => {
    const kitchen = plan({
      accommodationType: "airbnb_with_kitchen",
      budgetStyle: "balanced",
    });
    expect(shouldCookDinnerAtHome(kitchen, 1)).toBe(true);
    expect(shouldCookDinnerAtHome(kitchen, 2)).toBe(true);
  });

  it("never cooks at home on Treat Ourselves, even with a kitchen", () => {
    const kitchen = plan({
      accommodationType: "airbnb_with_kitchen",
      budgetStyle: "splurge",
    });
    expect(shouldCookDinnerAtHome(kitchen, 1)).toBe(false);
    expect(shouldCookDinnerAtHome(kitchen, 2)).toBe(false);
  });

  it("plans restaurant dinners with no grocery stops for splurge + kitchen", () => {
    const trip = plan({
      accommodationType: "airbnb_with_kitchen",
      budgetStyle: "splurge",
      startDate: "2026-09-15",
      endDate: "2026-09-18",
    });
    const { raw } = planTrip(trip, { plannerEngine: "score" });
    const titles = raw.days.flatMap((d) => d.activities.map((a) => a.title));
    expect(titles.some((t) => /cook dinner/i.test(t))).toBe(false);
    expect(titles.some((t) => /grocery/i.test(t))).toBe(false);
    expect(titles.some((t) => /dinner at /i.test(t))).toBe(true);
  });
});
