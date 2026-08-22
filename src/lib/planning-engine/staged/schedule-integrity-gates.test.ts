import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type CityConfig, type Landmark } from "@/config/city-pricing";
import {
  applyDailyThemes,
  buildScheduleFromBlueprint,
  buildTripStrategy,
  commitStopsToBlueprint,
  planMealsOnBlueprint,
  validateBlueprint,
  validateAndRepairBlueprint,
} from "@/lib/planning-engine/staged";
import { placementFromDayBlueprint } from "@/lib/planning-engine/staged/fill-stops";
import { fixRawDayActivities } from "@/lib/schedule/fix-itinerary";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Testville",
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    adults: 2,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    stayLat: 39.74,
    stayLng: -104.99,
    dietaryRestrictions: "",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Parks & Gardens", "Interactive Museums"],
    ...overrides,
  };
}

function landmark(
  name: string,
  interestTags: Landmark["interestTags"],
  kmNorth: number,
  overrides: Partial<Landmark> = {},
): Landmark {
  return {
    name,
    lat: 39.74 + kmNorth * 0.009,
    lng: -104.99,
    adultPrice: 0,
    openingHours: { open: "08:00", close: "20:00" },
    intensity: "medium",
    ageTags: ["child", "tween"],
    interestTags,
    indoor: false,
    ...overrides,
  };
}

function cityWith(landmarks: Landmark[]): CityConfig {
  return { ...CITY_CONFIGS[0]!, id: "test-city", landmarks };
}

describe("schedule integrity gates (FAM-84 rules 1, 7, 13, 14)", () => {
  it("does not invent a morning stop when blueprint support is empty (rules 13–14)", () => {
    const trip = plan();
    const city = cityWith([
      landmark("Discovery Lab", ["interactive"], 1, { indoor: true }),
      landmark("Riverside Park", ["parks"], 1.2),
    ]);
    const strategy = buildTripStrategy(trip, { city });
    const day = {
      ...(strategy.days.find((d) => d.role === "full") ?? strategy.days[1]!),
      anchor: {
        landmarkName: "Discovery Lab",
        placeId: undefined,
        role: "anchor" as const,
        interestTags: ["interactive"] as const,
        isPaid: false,
      },
      support: [],
    };
    const { ctx, dropSlotKinds } = placementFromDayBlueprint(city, trip, day, new Set());
    expect(ctx.morning.name).toBe("Discovery Lab");
    expect(ctx.afternoon.name).toBe("Discovery Lab");
    expect(dropSlotKinds).toContain("morning_activity");
  });

  it("single-outing schedule drops gap-filler skeleton slots (rule 14)", () => {
    const trip = plan();
    const city = cityWith([landmark("Discovery Lab", ["interactive"], 1, { indoor: true })]);
    const strategy = buildTripStrategy(trip, { city });
    const day = {
      ...(strategy.days.find((d) => d.role === "full") ?? strategy.days[1]!),
      anchor: {
        landmarkName: "Discovery Lab",
        role: "anchor" as const,
        interestTags: ["interactive"] as const,
        isPaid: false,
      },
      support: [],
      meals: [],
    };
    const { activities } = buildScheduleFromBlueprint(day, trip, city);
    expect(activities.some((a) => a.slotKind === "calm_activity")).toBe(false);
    expect(activities.some((a) => a.slotKind === "extra_activity")).toBe(false);
  });

  it("validate+repair clears support overload on full days (rule 7)", () => {
    const trip = plan();
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const themed = applyDailyThemes(buildTripStrategy(trip, { city }), trip, city);
    const committed = commitStopsToBlueprint(themed, trip, city);
    const { blueprint } = validateAndRepairBlueprint(committed, trip, city);
    const overload = validateBlueprint(blueprint, trip, city).filter(
      (v) => v.code === "day_overload",
    );
    expect(overload).toEqual([]);
  });

  it("staged pipeline produces overlap-free days after fixRawDayActivities (rule 1)", () => {
    const trip = plan();
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const themed = applyDailyThemes(buildTripStrategy(trip, { city }), trip, city);
    const withStops = commitStopsToBlueprint(themed, trip, city);
    const withMeals = planMealsOnBlueprint(withStops, trip, city);

    for (const day of withMeals.days.filter((d) => d.role === "full")) {
      const { activities, ctx } = buildScheduleFromBlueprint(day, trip, city);
      const fixed = fixRawDayActivities(activities, trip, undefined, ctx, day.dayIndex);
      const violations = validateDaySchedule(fixed, trip);
      expect(
        violations.filter((v) => v.code === "overlap" || v.code === "time_travel"),
        `day ${day.dayIndex}: ${violations.map((v) => v.message).join("; ")}`,
      ).toEqual([]);
    }
  });

  it("flags day_overload when support pushes load past budget (rule 7)", () => {
    const trip = plan({ travelStyle: "relaxed", children: [3, 4] });
    const city = cityWith([
      landmark("Neighborhood Park", ["parks"], 1, { intensity: "low" }),
      landmark("Heavy Museum", ["museums"], 1.1, { intensity: "high", indoor: true, adultPrice: 30 }),
      landmark("Extra Aquarium", ["interactive"], 1.2, { intensity: "high", indoor: true, adultPrice: 35 }),
    ]);
    const strategy = buildTripStrategy(trip, { city });
    const day = {
      ...(strategy.days.find((d) => d.role === "full") ?? strategy.days[1]!),
      anchor: {
        landmarkName: "Neighborhood Park",
        role: "anchor" as const,
        interestTags: ["parks"] as const,
        isPaid: false,
      },
      support: [
        {
          landmarkName: "Heavy Museum",
          role: "support" as const,
          interestTags: ["museums"] as const,
          isPaid: true,
        },
        {
          landmarkName: "Extra Aquarium",
          role: "support" as const,
          interestTags: ["interactive"] as const,
          isPaid: true,
        },
      ],
      meals: [],
    };
    const blueprint = {
      ...applyDailyThemes(strategy, trip, city),
      days: [day],
    };
    const violations = validateBlueprint(blueprint, trip, city);
    expect(violations.some((v) => v.code === "day_overload")).toBe(true);
  });
});
