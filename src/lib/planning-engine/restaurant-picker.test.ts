import { describe, expect, it } from "vitest";
import { detectCity } from "@/lib/city-detect";
import { planTrip } from "@/lib/planning-engine";
import {
  dietaryOptionRestaurantsForMeal,
  matchesDietaryNeeds,
  matchesDietaryOptions,
  parseDietaryTags,
  pickRestaurantForMeal,
  qualifyingRestaurantsForMeal,
} from "@/lib/planning-engine/restaurant-picker";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-08-10",
    endDate: "2026-08-12",
    adults: 2,
    children: [2],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "1:00 PM – 3:00 PM",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function mealPlaceName(title: string): string | null {
  const match = title.match(/\bat\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

describe("restaurant picker — FAM-46", () => {
  it("parses dietary quick picks from free text", () => {
    expect(parseDietaryTags("Vegetarian, Gluten-free")).toEqual(["vegetarian", "gluten-free"]);
    expect(parseDietaryTags("vegan")).toEqual(["vegan"]);
    expect(parseDietaryTags("Dairy-free")).toEqual(["dairy-free"]);
    expect(parseDietaryTags("")).toEqual([]);
  });

  it("lets vegetarians and dairy-free diners use vegan restaurants, but not vice versa", () => {
    const veganSpot = {
      name: "Pure Vegan Kitchen",
      lat: 0,
      lng: 0,
      meals: ["lunch" as const],
      ageTags: ["child" as const],
      dietary: ["vegan" as const],
      budgetStyles: ["balanced" as const],
      familyNote: "Fully vegan.",
    };
    const vegetarianOnly = {
      ...veganSpot,
      name: "Vegetarian Cafe",
      dietary: ["vegetarian" as const],
      dietaryOptions: ["vegan" as const],
      familyNote: "Vegetarian with vegan options.",
    };
    const dairyFreeOnly = {
      ...veganSpot,
      name: "Dairy Free Grill",
      dietary: ["dairy-free" as const],
      familyNote: "Dairy-free but not vegan.",
    };

    expect(matchesDietaryNeeds(veganSpot, ["vegetarian"])).toBe(true);
    expect(matchesDietaryNeeds(veganSpot, ["dairy-free"])).toBe(true);
    expect(matchesDietaryNeeds(veganSpot, ["vegan"])).toBe(true);

    expect(matchesDietaryNeeds(vegetarianOnly, ["vegan"])).toBe(false);
    expect(matchesDietaryNeeds(dairyFreeOnly, ["vegan"])).toBe(false);
    expect(matchesDietaryNeeds(dairyFreeOnly, ["vegetarian"])).toBe(false);

    // Vegan diners may still use a vegetarian spot only via vegan *options* fallback.
    expect(matchesDietaryOptions(vegetarianOnly, ["vegan"])).toBe(true);
    expect(matchesDietaryOptions(dairyFreeOnly, ["vegan"])).toBe(false);
  });

  it("uses primary-then-options-then-reuse for every dietary preference", () => {
    const city = detectCity("San Diego");
    const cases: {
      restriction: string;
      tag: "vegan" | "vegetarian" | "gluten-free" | "dairy-free";
    }[] = [
      { restriction: "Vegan", tag: "vegan" },
      { restriction: "Vegetarian", tag: "vegetarian" },
      { restriction: "Gluten-free", tag: "gluten-free" },
      { restriction: "Dairy-free", tag: "dairy-free" },
    ];

    for (const { restriction, tag } of cases) {
      const trip = plan({ dietaryRestrictions: restriction, children: [6] });
      const primary = qualifyingRestaurantsForMeal(city, trip, "lunch");
      const secondary = dietaryOptionRestaurantsForMeal(city, trip, "lunch");
      expect(primary.length, restriction).toBeGreaterThan(0);
      expect(secondary.length, restriction).toBeGreaterThan(0);

      const used = new Set<string>();
      for (let i = 0; i < primary.length; i++) {
        const pick = pickRestaurantForMeal(city, trip, {
          meal: "lunch",
          day: i + 1,
          excludeNames: used,
        });
        expect(pick, restriction).not.toBeNull();
        expect(matchesDietaryNeeds(pick!, [tag]), restriction).toBe(true);
        used.add(pick!.name);
      }

      const fallback = pickRestaurantForMeal(city, trip, {
        meal: "lunch",
        day: primary.length + 1,
        excludeNames: used,
      });
      expect(fallback, restriction).not.toBeNull();
      expect(matchesDietaryNeeds(fallback!, [tag]), restriction).toBe(false);
      expect(matchesDietaryOptions(fallback!, [tag]), restriction).toBe(true);
    }
  });

  it("picks dedicated vegan restaurants before vegan-option fallbacks", () => {
    const city = detectCity("San Diego");
    const veganPlan = plan({ dietaryRestrictions: "Vegan" });
    const primary = qualifyingRestaurantsForMeal(city, veganPlan, "lunch");
    const secondary = dietaryOptionRestaurantsForMeal(city, veganPlan, "lunch");
    expect(primary.length).toBeGreaterThan(0);
    expect(secondary.length).toBeGreaterThan(0);

    const used = new Set<string>();
    for (let i = 0; i < primary.length; i++) {
      const pick = pickRestaurantForMeal(city, veganPlan, {
        meal: "lunch",
        day: i + 1,
        excludeNames: used,
      });
      expect(pick).not.toBeNull();
      expect(matchesDietaryNeeds(pick!, ["vegan"])).toBe(true);
      used.add(pick!.name);
    }

    const fallback = pickRestaurantForMeal(city, veganPlan, {
      meal: "lunch",
      day: primary.length + 1,
      excludeNames: used,
    });
    expect(fallback).not.toBeNull();
    expect(matchesDietaryNeeds(fallback!, ["vegan"])).toBe(false);
    expect(matchesDietaryOptions(fallback!, ["vegan"])).toBe(true);
  });

  it("never suggests a place without vegan tags or vegan options when vegan is selected", () => {
    const city = detectCity("San Diego");
    const veganPlan = plan({ dietaryRestrictions: "Vegan", children: [6] });
    const used = new Set<string>();

    for (let day = 1; day <= 8; day++) {
      for (const meal of ["breakfast", "lunch", "dinner"] as const) {
        const picked = pickRestaurantForMeal(city, veganPlan, {
          meal,
          day,
          excludeNames: used,
        });
        if (!picked) continue;
        const ok =
          matchesDietaryNeeds(picked, ["vegan"]) || matchesDietaryOptions(picked, ["vegan"]);
        expect(ok).toBe(true);
        used.add(picked.name);
      }
    }
  });

  it("prefers toddler-friendly spots for age 0–3", () => {
    const city = detectCity("San Diego");
    const picked = pickRestaurantForMeal(city, plan({ children: [0] }), {
      meal: "breakfast",
      day: 1,
    });
    expect(picked?.ageTags).toContain("toddler");
  });

  it("names real restaurants on the scheduled day (not bakery/café placeholders)", () => {
    const { raw } = planTrip(plan());
    const meals = raw.days[0].activities.filter((a) => a.type === "meal");
    expect(meals.length).toBeGreaterThanOrEqual(2);

    for (const meal of meals) {
      expect(meal.title.toLowerCase()).not.toMatch(/bakery or café|bakery or cafe/);
      expect(meal.title).toMatch(/\bat\b/i);
      expect(meal.notes?.toLowerCase() ?? "").not.toMatch(/confirm the menu|standout/);
    }
  });

  it("mentions dietary fit without asking the user to double-check the menu", () => {
    const { raw } = planTrip(plan({ dietaryRestrictions: "Gluten-free", children: [6] }));
    const meals = raw.days.flatMap((d) => d.activities.filter((a) => a.type === "meal"));
    expect(meals.length).toBeGreaterThan(0);
    for (const meal of meals) {
      expect(meal.notes?.toLowerCase()).toMatch(/gluten-free/);
      expect(meal.notes?.toLowerCase() ?? "").not.toMatch(/confirm the menu|standout/);
    }
  });

  it("does not reuse until primary vegan spots and vegan-option spots are exhausted", () => {
    const city = detectCity("San Diego");
    const trip = plan({ dietaryRestrictions: "Vegan", children: [6] });
    const primary = qualifyingRestaurantsForMeal(city, trip, "dinner");
    const secondary = dietaryOptionRestaurantsForMeal(city, trip, "dinner");
    const pool = [...primary, ...secondary];
    expect(pool.length).toBeGreaterThan(3);

    const used = new Set<string>();
    const picks: string[] = [];

    for (let i = 0; i < pool.length; i++) {
      const pick = pickRestaurantForMeal(city, trip, {
        meal: "dinner",
        day: i + 1,
        excludeNames: used,
      });
      expect(pick).not.toBeNull();
      expect(used.has(pick!.name)).toBe(false);
      picks.push(pick!.name);
      used.add(pick!.name);
    }

    expect(new Set(picks).size).toBe(pool.length);

    const reuse = pickRestaurantForMeal(city, trip, {
      meal: "dinner",
      day: pool.length + 1,
      excludeNames: used,
    });
    expect(reuse).not.toBeNull();
    expect(used.has(reuse!.name)).toBe(true);
  });

  it("varies named restaurants on a vegan multi-day trip without early repeats", () => {
    const { raw } = planTrip(
      plan({
        startDate: "2026-08-10",
        endDate: "2026-08-13",
        children: [6, 10],
        napSchedule: "No naps needed",
        dietaryRestrictions: "Vegan",
      }),
    );

    const names = raw.days.flatMap((d) =>
      d.activities
        .filter((a) => a.type === "meal")
        .map((a) => mealPlaceName(a.title))
        .filter((n): n is string => Boolean(n)),
    );

    const city = detectCity("San Diego");
    const trip = plan({ children: [6, 10], dietaryRestrictions: "Vegan" });
    const poolSize = new Set(
      (["breakfast", "lunch", "dinner"] as const).flatMap((meal) => [
        ...qualifyingRestaurantsForMeal(city, trip, meal).map((r) => r.name),
        ...dietaryOptionRestaurantsForMeal(city, trip, meal).map((r) => r.name),
      ]),
    ).size;

    const expectedUnique = Math.min(names.length, poolSize);
    expect(new Set(names).size).toBe(expectedUnique);
    expect(names.join(" ")).not.toMatch(/standout/i);
  });
});
