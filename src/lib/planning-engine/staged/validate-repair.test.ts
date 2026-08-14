import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import {
  applyDailyThemes,
  buildTripStrategy,
  commitStopsToBlueprint,
  planMealsOnBlueprint,
  repairBlueprint,
  toCommittedStop,
  validateAndRepairBlueprint,
  validateBlueprint,
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
      "Playgrounds & Indoor Play",
      "Interactive Museums",
      "Beaches & Waterfronts",
      "Shows & Entertainment",
    ],
    ...overrides,
  };
}

describe("validateBlueprint", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("flags far unpaid arrival anchors outside the low-friction stay ring", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const torrey = city.landmarks.find((l) => l.name === "Torrey Pines State Natural Reserve")!;
    const arrival = {
      ...withStops.days[0]!,
      anchor: toCommittedStop(torrey, "anchor"),
      support: [],
    };
    const blueprint = {
      ...withStops,
      days: [arrival, ...withStops.days.slice(1)],
    };

    const violations = validateBlueprint(blueprint, plan, city);
    expect(violations.some((v) => v.code === "travel_day_far" && v.day === 1)).toBe(true);
  });

  it("flags theme mismatch when a beach day is anchored at an indoor museum", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;
    const beachIdx = withStops.days.findIndex((d) => d.theme.id === "beach");
    expect(beachIdx).toBeGreaterThanOrEqual(0);
    const days = withStops.days.map((d, i) =>
      i === beachIdx
        ? { ...d, anchor: toCommittedStop(fleet, "anchor"), support: [] }
        : d,
    );
    const violations = validateBlueprint({ ...withStops, days }, plan, city);
    expect(
      violations.some(
        (v) =>
          (v.code === "theme_mismatch" || v.code === "beach_not_shoreline") &&
          v.day === days[beachIdx]!.dayIndex,
      ),
    ).toBe(true);
  });

  it("flags named meals that are not in the planning city catalog", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const withMeals = planMealsOnBlueprint(withStops, plan, city);
    const day0 = withMeals.days[0]!;
    const days = [
      {
        ...day0,
        meals: day0.meals.map((m) =>
          m.slot === "dinner"
            ? {
                ...m,
                mode: "named_restaurant" as const,
                restaurantName: "Café de Flore",
              }
            : m,
        ),
      },
      ...withMeals.days.slice(1),
    ];
    const violations = validateBlueprint({ ...withMeals, days }, plan, city);
    expect(violations.some((v) => v.code === "meal_cross_city" && v.day === 1)).toBe(true);
  });
});

describe("repairBlueprint", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("replaces a far arrival anchor without rewriting other days' anchors", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const torrey = city.landmarks.find((l) => l.name === "Torrey Pines State Natural Reserve")!;
    const otherAnchors = withStops.days.slice(1).map((d) => d.anchor!.landmarkName);
    const broken = {
      ...withStops,
      days: [
        {
          ...withStops.days[0]!,
          anchor: toCommittedStop(torrey, "anchor"),
          support: [],
        },
        ...withStops.days.slice(1),
      ],
    };

    const before = validateBlueprint(broken, plan, city);
    expect(before.some((v) => v.code === "travel_day_far")).toBe(true);

    const repaired = repairBlueprint(broken, plan, city, before);
    expect(repaired.days[0]!.anchor!.landmarkName).not.toBe(torrey.name);
    expect(repaired.days.slice(1).map((d) => d.anchor!.landmarkName)).toEqual(otherAnchors);

    const after = validateBlueprint(repaired, plan, city);
    expect(after.some((v) => v.code === "travel_day_far" && v.day === 1)).toBe(false);
  });

  it("clears cross-city dinner names by regenerating meals for that day only", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const withStops = commitStopsToBlueprint(themed, plan, city);
    const withMeals = planMealsOnBlueprint(withStops, plan, city);
    const otherDinners = withMeals.days.slice(1).map((d) => {
      const dinner = d.meals.find((m) => m.slot === "dinner");
      return dinner?.restaurantName ?? dinner?.mode;
    });
    const day0 = withMeals.days[0]!;
    const broken = {
      ...withMeals,
      days: [
        {
          ...day0,
          meals: day0.meals.map((m) =>
            m.slot === "dinner"
              ? {
                  ...m,
                  mode: "named_restaurant" as const,
                  restaurantName: "Café de Flore",
                }
              : m,
          ),
        },
        ...withMeals.days.slice(1),
      ],
    };

    const { blueprint, violations, repaired } = validateAndRepairBlueprint(broken, plan, city);
    expect(repaired).toBe(true);
    const dinner = blueprint.days[0]!.meals.find((m) => m.slot === "dinner")!;
    expect(dinner.restaurantName).not.toBe("Café de Flore");
    expect(violations.some((v) => v.code === "meal_cross_city")).toBe(false);
    expect(
      blueprint.days.slice(1).map((d) => {
        const dnr = d.meals.find((m) => m.slot === "dinner");
        return dnr?.restaurantName ?? dnr?.mode;
      }),
    ).toEqual(otherDinners);
  });
});

describe("planTrip staged validate+repair", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("emits a blueprint with no soft-validation violations after the pipeline", () => {
    const { blueprint } = planTrip(sdPlan(), {
      cityOverride: city,
      plannerEngine: "staged",
    });
    expect(blueprint).toBeDefined();
    expect(validateBlueprint(blueprint!, sdPlan(), city)).toEqual([]);
  });
});
