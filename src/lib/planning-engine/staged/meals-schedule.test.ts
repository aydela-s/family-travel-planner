import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { restaurantsForCityId } from "@/config/city-restaurants";
import { planTrip } from "@/lib/planning-engine";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import {
  applyDailyThemes,
  buildTripStrategy,
  commitStopsToBlueprint,
  planMealsOnBlueprint,
} from "@/lib/planning-engine/staged";
import type { TripPlan } from "@/types/trip-plan";

function sdPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    stayAddress: "Carlton",
    stayLat: 32.7157,
    stayLng: -117.1611,
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [
      "Indoor & Outdoor Play",
      "Interactive Museums",
      "Swimming & Water Play",
      "Shows & Entertainment",
    ],
    ...overrides,
  };
}

describe("planMealsOnBlueprint", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
  const sdNames = new Set(restaurantsForCityId("san-diego").map((r) => r.name));

  it("only names San Diego restaurants for vegan dinners (no cross-city invent)", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const withMeals = planMealsOnBlueprint(withStops, plan, city);

    for (const day of withMeals.days) {
      for (const meal of day.meals) {
        if (meal.mode === "named_restaurant" && meal.restaurantName) {
          expect(sdNames.has(meal.restaurantName)).toBe(true);
        }
      }
    }
    expect(withMeals.ledger.restaurantNames.every((n) => sdNames.has(n))).toBe(true);
  });

  it("sets lunch nearLandmarkName to the day anchor when present", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const withMeals = planMealsOnBlueprint(withStops, plan, city);

    const interactive = withMeals.days.find((d) => d.theme.id === "interactive");
    expect(interactive?.anchor).toBeDefined();
    const lunch = interactive!.meals.find((m) => m.slot === "lunch");
    expect(lunch).toBeDefined();
    // Nap delivery still records nearLandmarkName as the anchor for geo intent
    expect(lunch!.nearLandmarkName).toBe(interactive!.anchor!.landmarkName);
  });

  it("uses delivery_at_stay (not takeout) when nap overlaps lunch (FAM-82)", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const withMeals = planMealsOnBlueprint(withStops, plan, city);

    const lunches = withMeals.days.flatMap((d) => d.meals.filter((m) => m.slot === "lunch"));
    expect(lunches.length).toBeGreaterThan(0);
    expect(lunches.every((m) => m.mode === "delivery_at_stay")).toBe(true);
  });
});

describe("planTrip staged meals + schedule", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("emits delivery lunch at stay with no takeout wording (FAM-82)", () => {
    const { raw } = planTrip(sdPlan(), { cityOverride: city, plannerEngine: "staged" });
    const dayActivities = raw.days[0]!.activities;
    const lunch = dayActivities.find((a) => a.type === "meal" && /lunch/i.test(a.title));
    expect(lunch).toBeDefined();
    expect(lunch!.title).toBe("Delivery lunch at your stay");
    expect(`${lunch!.title} ${lunch!.notes ?? ""}`.toLowerCase()).not.toMatch(/takeout/);

    const lunchIdx = dayActivities.findIndex((a) => a === lunch);
    const napIdx = dayActivities.findIndex((a) => a.type === "nap");
    expect(napIdx).toBeGreaterThan(lunchIdx);

    // Family is at the stay for lunch (travel home lands before delivery meal when a hop exists).
    const beforeLunch = dayActivities.slice(0, lunchIdx);
    const travelHome = [...beforeLunch].reverse().find((a) => a.type === "travel");
    if (travelHome) {
      expect(parseTimeToMinutes(travelHome.endTime ?? travelHome.time)).toBeLessThanOrEqual(
        parseTimeToMinutes(lunch!.time),
      );
    }
  });

  it("keeps typed nap window in schedule without protected-downtime notes", () => {
    const { raw } = planTrip(sdPlan(), { cityOverride: city, plannerEngine: "staged" });
    const nap = raw.days.flatMap((d) => d.activities).find((a) => a.type === "nap");
    expect(nap).toBeDefined();
    expect(nap!.title).toMatch(/^Nap$/i);
    expect(nap!.notes).toBeUndefined();
    expect(parseTimeToMinutes(nap!.time)).toBeGreaterThanOrEqual(12 * 60 + 25);
    expect(parseTimeToMinutes(nap!.endTime!)).toBeLessThanOrEqual(14 * 60 + 20);
  });

  it("includes committed anchor names in activity titles", () => {
    const { raw, blueprint } = planTrip(sdPlan(), {
      cityOverride: city,
      plannerEngine: "staged",
    });
    expect(blueprint?.days.every((d) => d.meals.length > 0)).toBe(true);
    const titles = raw.days.flatMap((d) => d.activities.map((a) => a.title)).join(" | ");
    for (const day of blueprint!.days) {
      expect(titles).toContain(day.anchor!.landmarkName);
    }
  });

  it("names only city-catalog restaurants on the staged timeline", () => {
    const sdNames = new Set(restaurantsForCityId("san-diego").map((r) => r.name));
    const { raw, blueprint } = planTrip(sdPlan(), {
      cityOverride: city,
      plannerEngine: "staged",
    });
    for (const name of blueprint!.ledger.restaurantNames) {
      expect(sdNames.has(name)).toBe(true);
    }
    const dinnerTitles = raw.days
      .flatMap((d) => d.activities)
      .filter((a) => a.type === "meal" && /Dinner at /i.test(a.title))
      .map((a) => a.title.replace(/^Dinner at\s+/i, "").trim());
    for (const name of dinnerTitles) {
      expect(sdNames.has(name)).toBe(true);
    }
  });
});
