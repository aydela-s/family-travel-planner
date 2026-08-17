import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type CityConfig, type Landmark } from "@/config/city-pricing";
import type { CityRestaurant } from "@/config/city-restaurants";
import type { PlannerConflict } from "@/lib/planning-engine/conflicts";
import {
  mealDetourKm,
  mealDetourLimits,
  mealDetourMin,
  pickRestaurantWithRoute,
} from "@/lib/planning-engine/restaurant-picker";
import { dietaryCheckNote } from "@/lib/planning-engine/staged/meal-planner";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Denver",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "vegan",
    naps: [],
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

/** ~0.009° of latitude is ~1 km, so these fixtures read in kilometers. */
function stop(name: string, kmNorth: number): Landmark {
  return {
    name,
    lat: 39.74 + kmNorth * 0.009,
    lng: -104.99,
    adultPrice: 0,
    openingHours: { open: "09:00", close: "18:00" },
    intensity: "medium",
    ageTags: ["child"],
    interestTags: ["museums"],
    indoor: true,
  };
}

function restaurant(
  name: string,
  kmNorth: number,
  overrides: Partial<CityRestaurant> = {},
): CityRestaurant {
  return {
    name,
    lat: 39.74 + kmNorth * 0.009,
    lng: -104.99,
    meals: ["breakfast", "lunch", "dinner"],
    ageTags: ["toddler", "child", "tween", "teen"],
    dietary: [],
    budgetStyles: ["save", "balanced", "splurge"],
    familyNote: "Family friendly.",
    ...overrides,
  };
}

function cityWith(restaurants: CityRestaurant[]): CityConfig {
  return { ...CITY_CONFIGS[0]!, id: "test-city", restaurants };
}

const morning = stop("Morning museum", 0);
const afternoon = stop("Afternoon playground", 4);

describe("restaurant routing — no long detours for a dietary match", () => {
  it("measures the extra distance a meal adds to the day's route", () => {
    // Directly between the two stops: no extra driving at all.
    expect(mealDetourKm(restaurant("On the way", 2), { from: morning, to: afternoon })).toBeCloseTo(
      0,
      1,
    );
    // 10 km past the afternoon stop and back is a big detour.
    expect(
      mealDetourKm(restaurant("Far away", 14), { from: morning, to: afternoon }),
    ).toBeGreaterThan(15);
  });

  it("allows a bigger detour by car than on foot", () => {
    expect(mealDetourLimits({ transportationType: "car-rental" }).maxKm).toBeGreaterThan(
      mealDetourLimits({ transportationType: "walking" }).maxKm,
    );
  });

  it("prefers a nearby vegan spot over a distant one", () => {
    const city = cityWith([
      restaurant("Close Vegan Kitchen", 2, { dietary: ["vegan"] }),
      restaurant("Far Vegan Kitchen", 40, { dietary: ["vegan"], rating: 4.9 }),
    ]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "lunch",
      day: 1,
      near: morning,
      routeFrom: morning,
      routeTo: afternoon,
    });
    expect(pick?.restaurant.name).toBe("Close Vegan Kitchen");
    expect(pick?.dietaryFit).toBe("strong");
  });

  it("takes a close restaurant with vegan options over a 40 km vegan detour", () => {
    const city = cityWith([
      restaurant("Far Vegan Kitchen", 40, { dietary: ["vegan"], rating: 4.9 }),
      restaurant("Corner Cafe", 2, { dietary: [], dietaryOptions: ["vegan"] }),
    ]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "lunch",
      day: 1,
      near: morning,
      routeFrom: morning,
      routeTo: afternoon,
    });
    expect(pick?.restaurant.name).toBe("Corner Cafe");
    expect(pick?.dietaryFit).toBe("options");
    expect(pick!.detourKm).toBeLessThan(mealDetourLimits(plan()).maxKm);
  });

  it("keeps every meal within the mode's detour limit when a nearby option exists", () => {
    const city = cityWith([
      restaurant("Far Vegan Kitchen", 40, { dietary: ["vegan"] }),
      restaurant("Neighborhood Grill", 1, { dietary: [], dietaryOptions: ["vegan"] }),
    ]);
    const { maxKm } = mealDetourLimits(plan());
    for (const meal of ["breakfast", "lunch", "dinner"] as const) {
      const pick = pickRestaurantWithRoute(city, plan(), {
        meal,
        day: 1,
        near: morning,
        routeFrom: morning,
        routeTo: afternoon,
      });
      expect(pick!.detourKm).toBeLessThanOrEqual(maxKm);
    }
  });

  it("tells the user to check the menu when the close pick is not a dedicated vegan spot", () => {
    expect(dietaryCheckNote(plan(), "options")).toMatch(/check the current menu/i);
    expect(dietaryCheckNote(plan(), "unverified")).toMatch(/check the current menu|call ahead/i);
    expect(dietaryCheckNote(plan(), "strong")).toBe("");
    expect(dietaryCheckNote(plan({ dietaryRestrictions: "" }), "options")).toBe("");
  });

  it("still names a far restaurant while it is inside the mode's detour limit", () => {
    const { maxKm } = mealDetourLimits(plan());
    // A few km past the afternoon stop: a real drive, but fine on a car day.
    const city = cityWith([restaurant("Edge Of Town Vegan", 8, { dietary: ["vegan"] })]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "lunch",
      day: 1,
      near: morning,
      routeFrom: morning,
      routeTo: afternoon,
    });
    expect(pick?.restaurant.name).toBe("Edge Of Town Vegan");
    expect(pick!.detourKm).toBeLessThanOrEqual(maxKm);
  });

  it("schedules no restaurant at all rather than a cross-metro drive", () => {
    const city = cityWith([restaurant("Only Vegan In Town", 40, { dietary: ["vegan"] })]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "lunch",
      day: 1,
      near: morning,
      routeFrom: morning,
      routeTo: afternoon,
    });
    // 40 km out and back is worse for the family than eating near the day's
    // stops, so the meal becomes casual copy with a menu-check note.
    expect(pick).toBeNull();
    expect(dietaryCheckNote(plan(), "none")).toMatch(/look for vegan options nearby/i);
  });

  it("applies the limit per mode — a walking day never takes a car-sized detour", () => {
    const city = cityWith([restaurant("Vegan Down The Road", 6, { dietary: ["vegan"] })]);
    const onFoot = plan({ transportationType: "walking" });
    expect(
      pickRestaurantWithRoute(city, onFoot, {
        meal: "lunch",
        day: 1,
        near: morning,
        routeFrom: morning,
        routeTo: afternoon,
      }),
    ).toBeNull();
    expect(
      pickRestaurantWithRoute(city, plan(), {
        meal: "lunch",
        day: 1,
        near: morning,
        routeFrom: morning,
        routeTo: afternoon,
      })?.restaurant.name,
    ).toBe("Vegan Down The Road");
  });

  it("never reuses a restaurant already used on the trip", () => {
    const city = cityWith([
      restaurant("Close Vegan Kitchen", 2, { dietary: ["vegan"] }),
      restaurant("Second Vegan Kitchen", 3, { dietary: ["vegan"] }),
    ]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "lunch",
      day: 2,
      near: morning,
      routeFrom: morning,
      routeTo: afternoon,
      excludeNames: new Set(["Close Vegan Kitchen"]),
    });
    expect(pick?.restaurant.name).toBe("Second Vegan Kitchen");
  });

  it("prefers an 8-minute restaurant with vegan options over a 35-minute dedicated kitchen", () => {
    const stay = stop("Stay", 0);
    const nearby = restaurant("Corner Cafe", 4, {
      dietary: [],
      dietaryOptions: ["vegan"],
    });
    const dedicated = restaurant("Far Vegan Kitchen", 22, { dietary: ["vegan"], rating: 4.9 });
    const city = cityWith([nearby, dedicated]);
    const trip = plan();
    const pick = pickRestaurantWithRoute(city, trip, {
      meal: "dinner",
      day: 1,
      near: stay,
      routeFrom: stay,
      routeTo: stay,
    });
    expect(mealDetourMin(nearby, { from: stay, to: stay }, trip)).toBeLessThan(12);
    expect(mealDetourMin(dedicated, { from: stay, to: stay }, trip)).toBeGreaterThan(30);
    expect(pick?.restaurant.name).toBe("Corner Cafe");
    expect(pick?.dietaryFit).toBe("options");
  });

  it("lets a dedicated vegan kitchen a couple of minutes farther still win", () => {
    const stay = stop("Stay", 0);
    const nearby = restaurant("Corner Cafe", 1, {
      dietary: [],
      dietaryOptions: ["vegan"],
    });
    const dedicated = restaurant("Next Door Vegan", 2, { dietary: ["vegan"] });
    const city = cityWith([nearby, dedicated]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "dinner",
      day: 1,
      near: stay,
      routeFrom: stay,
      routeTo: stay,
    });
    expect(pick?.restaurant.name).toBe("Next Door Vegan");
    expect(pick?.dietaryFit).toBe("strong");
  });

  it("does not pick a restaurant known to be closed at the meal window", () => {
    const stay = stop("Stay", 0);
    const closed = restaurant("Closed Kitchen", 2, {
      dietary: ["vegan"],
      hoursByWeekday: { 2: null },
      openingHours: { open: "11:00", close: "21:00" },
    });
    const open = restaurant("Open Kitchen", 3, { dietary: ["vegan"] });
    const city = cityWith([closed, open]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "dinner",
      day: 1,
      near: stay,
      routeFrom: stay,
      routeTo: stay,
      visitWindow: { startMin: 18 * 60, endMin: 19 * 60, visitDate: "2026-08-11" },
    });
    expect(pick?.restaurant.name).toBe("Open Kitchen");
  });

  it("keeps an hours-unknown restaurant eligible", () => {
    const stay = stop("Stay", 0);
    const unknown = restaurant("No Hours Kitchen", 2, { dietary: ["vegan"] });
    const city = cityWith([unknown]);
    const pick = pickRestaurantWithRoute(city, plan(), {
      meal: "dinner",
      day: 1,
      near: stay,
      routeFrom: stay,
      routeTo: stay,
      visitWindow: { startMin: 18 * 60, endMin: 19 * 60, visitDate: "2026-08-11" },
    });
    expect(pick?.restaurant.name).toBe("No Hours Kitchen");
  });

  it("records a conflict when strict vegan and a 15 min drive cap cannot both be met", () => {
    const stay = stop("Stay", 0);
    const nearbyOptions = restaurant("Corner Cafe", 4, {
      dietary: [],
      dietaryOptions: ["vegan"],
    });
    const farDedicated = restaurant("Far Vegan Kitchen", 22, { dietary: ["vegan"] });
    const city = cityWith([nearbyOptions, farDedicated]);
    const trip = plan({
      dietaryRestrictions: "only vegan restaurants",
      userConstraints: { maxDriveMin: 15 },
    });
    const conflicts: PlannerConflict[] = [];
    const pick = pickRestaurantWithRoute(city, trip, {
      meal: "dinner",
      day: 1,
      near: stay,
      routeFrom: stay,
      routeTo: stay,
      conflicts,
    });
    expect(pick).toBeNull();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.code).toBe("dietary_unreachable");
    expect(conflicts[0]!.options.some((o) => o.name === "Far Vegan Kitchen")).toBe(true);
    expect(conflicts[0]!.options.some((o) => o.violates.includes("max_drive_min"))).toBe(true);
    expect(conflicts[0]!.options.some((o) => o.name === "Corner Cafe")).toBe(true);
    expect(conflicts[0]!.options.some((o) => o.violates.includes("dietary_required"))).toBe(true);
  });
});
