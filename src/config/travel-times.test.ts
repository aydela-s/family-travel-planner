import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { TRAVEL_TIME_BY_MODE, travelTimeBudget } from "@/config/travel-times";
import { getDirections } from "@/lib/maps/directions";
import { estimateDurationMin, travelFrictionScore } from "@/lib/maps/travel-estimate";
import { applyDailyThemes, buildTripStrategy } from "@/lib/planning-engine/staged";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    stayLat: 32.7157,
    stayLng: -117.1611,
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Shows & Entertainment", "Beaches & Waterfronts", "Playgrounds & Indoor Play"],
    ...overrides,
  };
}

describe("FAM-78 travel-time budgets", () => {
  it("gives taxis a tighter preferred window than car rental", () => {
    expect(TRAVEL_TIME_BY_MODE.taxis.preferredMin).toBe(30);
    expect(TRAVEL_TIME_BY_MODE["car-rental"].preferredMin).toBe(45);
    expect(TRAVEL_TIME_BY_MODE["car-rental"].softMaxMin).toBe(60);
    expect(TRAVEL_TIME_BY_MODE.taxis.preferredMin).toBeLessThan(
      TRAVEL_TIME_BY_MODE["car-rental"].preferredMin,
    );
  });

  it("lets packed trips travel farther and relaxed / young kids travel less", () => {
    const balanced = travelTimeBudget(plan({ travelStyle: "balanced", children: [8] }));
    const packed = travelTimeBudget(plan({ travelStyle: "packed", children: [8] }));
    const toddler = travelTimeBudget(plan({ travelStyle: "balanced", children: [2] }));
    expect(packed.preferredMin).toBeGreaterThan(balanced.preferredMin);
    expect(toddler.preferredMin).toBeLessThan(balanced.preferredMin);
  });

  it("penalizes hops past the preferred window instead of a hard cutoff", () => {
    const budget = travelTimeBudget(plan({ transportationType: "taxis" }));
    const inside = travelFrictionScore(20, budget);
    const preferredEdge = travelFrictionScore(budget.preferredMin, budget);
    const pastPreferred = travelFrictionScore(budget.preferredMin + 8, budget);
    const pastSoft = travelFrictionScore(budget.softMaxMin + 20, budget);
    expect(inside).toBeGreaterThan(preferredEdge);
    expect(preferredEdge).toBeGreaterThan(pastPreferred);
    expect(pastPreferred).toBeGreaterThan(pastSoft);
  });

  it("keeps high-value attractions eligible a bit beyond preferred taxi time", () => {
    const budget = travelTimeBudget(plan({ transportationType: "taxis" }));
    const normal = travelFrictionScore(budget.softMaxMin - 2, budget);
    const highValue = travelFrictionScore(budget.softMaxMin - 2, budget, { highValue: true });
    expect(highValue).toBeGreaterThan(normal);
  });
});

describe("taxi fare for walkable hops", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("does not bill Uber for same-location hotel hops (lunch then nap)", async () => {
    const stay = { lat: 32.7157, lng: -117.1611 };
    const dir = await getDirections(city, stay, stay, "taxis", 0);
    expect(dir.cost).toBe(0);
    expect(dir.provider).toBe("Walk");
  });
});

describe("taxi same-day support stays inside the time budget", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("pairs Belmont Park with a hop inside the taxi soft-max window", () => {
    const trip = plan({ transportationType: "taxis" });
    const belmont = city.landmarks.find((l) => l.name === "Belmont Park")!;
    const themed = applyDailyThemes(buildTripStrategy(trip, { city }), trip, city);
    const day = {
      ...themed.days[1]!,
      role: "full" as const,
      theme: {
        id: "entertainment" as const,
        label: "Entertainment",
        primaryTags: ["entertainment" as const],
        secondaryTags: ["theme-parks" as const],
        preferredExperienceTypes: ["entertainment" as const, "theme-parks" as const],
      },
      constraints: [],
      dayBudgetIntent: "paid" as const,
      support: [],
      meals: [],
    };
    const support = selectSupportForDay(city, trip, day, belmont, {
      ledgerNames: new Set(
        city.landmarks.map((l) => l.name).filter((n) => n !== belmont.name && n !== "Mission Beach Boardwalk"),
      ),
      alreadyToday: [belmont],
    });
    const budget = travelTimeBudget(trip);
    for (const stop of support) {
      const hop = estimateDurationMin(belmont, stop, trip);
      expect(hop).toBeLessThanOrEqual(Math.round(budget.softMaxMin * 1.25));
    }
  });
});
