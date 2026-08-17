import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  directionsTravelMode,
  TRAVEL_TIME_BY_MODE,
  travelDayBudget,
  travelTimeBudget,
} from "@/config/travel-times";
import { getDirections } from "@/lib/maps/directions";
import {
  estimateDurationMin,
  estimateRoutedMetrics,
  travelFrictionScore,
} from "@/lib/maps/travel-estimate";
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

  it("tightens arrival/departure windows vs full-day preferred", () => {
    const taxi = plan({ transportationType: "taxis" });
    const car = plan({ transportationType: "car-rental" });
    const taxiDay = travelDayBudget(taxi);
    const carDay = travelDayBudget(car);
    expect(taxiDay.softMaxMin).toBe(travelTimeBudget(taxi).preferredMin);
    expect(carDay.softMaxMin).toBe(travelTimeBudget(car).preferredMin);
    expect(taxiDay.preferredMin).toBeLessThan(carDay.preferredMin);
    expect(taxiDay.softMaxMin).toBeLessThan(carDay.softMaxMin);
  });

  it("maps public transit to Google transit mode, not driving", () => {
    expect(directionsTravelMode("public-transportation")).toBe("transit");
    expect(directionsTravelMode("taxis")).toBe("driving");
    expect(directionsTravelMode("car-rental")).toBe("driving");
    expect(directionsTravelMode("walking")).toBe("walking");
  });

  it("estimates transit hops slower than the same driving hop", () => {
    const drive = estimateRoutedMetrics(8, "driving");
    const transit = estimateRoutedMetrics(8, "transit");
    expect(transit.durationMin).toBeGreaterThan(drive.durationMin);
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const stay = { lat: 32.7157, lng: -117.1611 };
    const cove = city.landmarks.find((l) => l.name === "La Jolla Cove")!;
    const byCar = estimateDurationMin(stay, cove, plan({ transportationType: "car-rental" }));
    const byTransit = estimateDurationMin(
      stay,
      cove,
      plan({ transportationType: "public-transportation" }),
    );
    expect(byTransit).toBeGreaterThan(byCar);
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

  it("does not bill taxi between picnic-near and explore at the same venue", async () => {
    const { buildRouteSegments } = await import("@/lib/maps/route-segments");
    const trip = plan({
      transportationType: "taxis",
      stayLat: 32.7157,
      stayLng: -117.1611,
      stayAddress: "Hotel Stay",
    });
    const result = await buildRouteSegments(
      [
        {
          time: "12:00",
          title: "Picnic near Kids Empire Dallas Hillcrest",
          type: "meal",
          location: {
            name: "Kids Empire Dallas Hillcrest area",
            lat: 32.84,
            lng: -96.78,
          },
        },
        {
          time: "14:00",
          title: "Family time at Kids Empire Dallas Hillcrest",
          type: "activity",
          location: {
            name: "Kids Empire Dallas Hillcrest",
            lat: 32.84,
            lng: -96.78,
          },
        },
      ],
      city,
      trip,
    );
    const sameVenue = result.routeSegments.find(
      (s) =>
        /kids empire/i.test(s.from) &&
        /kids empire/i.test(s.to) &&
        !/hotel stay/i.test(s.from) &&
        !/hotel stay/i.test(s.to),
    );
    expect(sameVenue?.cost).toBe(0);
    expect(sameVenue?.provider).toBe("Walk");
    expect(sameVenue?.distanceKm).toBe(0);
  });
});

describe("taxi same-day support stays inside the time budget", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("keeps theme parks exclusive (no same-day companion hop)", () => {
    const trip = plan({ transportationType: "taxis" });
    const belmont = city.landmarks.find((l) => l.name === "Belmont Park")!;
    const themed = applyDailyThemes(buildTripStrategy(trip, { city }), trip, city);
    const day = {
      ...themed.days[1]!,
      role: "full" as const,
      theme: {
        id: "theme_park" as const,
        label: "Theme park",
        primaryTags: ["theme-parks" as const],
        secondaryTags: ["entertainment" as const],
        preferredExperienceTypes: ["theme-parks" as const, "entertainment" as const],
      },
      constraints: [
        { type: "require_half_day_window" as const },
        { type: "max_activities" as const, n: 1 },
      ],
      dayBudgetIntent: "paid" as const,
      support: [],
      meals: [],
    };
    const support = selectSupportForDay(city, trip, day, belmont, {
      ledgerNames: new Set(
        city.landmarks.map((l) => l.name).filter((n) => n !== belmont.name),
      ),
      alreadyToday: [belmont],
    });
    expect(support).toHaveLength(0);
  });
});
