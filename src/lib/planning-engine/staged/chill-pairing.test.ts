import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type CityConfig, type Landmark } from "@/config/city-pricing";
import { emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
import { placementFromDayBlueprint } from "@/lib/planning-engine/staged/fill-stops";
import {
  isChillDayCompanion,
  isLongShoppingExperience,
  pairingAllowedForDay,
} from "@/lib/planning-engine/staged/landmark-experience";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import type { DayBlueprint } from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Testville",
    startDate: "2026-09-15",
    endDate: "2026-09-17",
    adults: 2,
    children: [6, 9],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    stayLat: 32.7157,
    stayLng: -117.1611,
    dietaryRestrictions: "",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Theme Parks", "Shopping", "Parks & Gardens"],
    ...overrides,
  };
}

function landmark(
  name: string,
  interestTags: Landmark["interestTags"],
  overrides: Partial<Landmark> = {},
): Landmark {
  return {
    name,
    lat: 32.72,
    lng: -117.16,
    adultPrice: 0,
    openingHours: { open: "09:00", close: "20:00" },
    intensity: "low",
    ageTags: ["child", "tween"],
    interestTags,
    indoor: false,
    ...overrides,
  };
}

function shoppingDay(anchor: Landmark, rules = emptyPlanningRules(plan())): DayBlueprint {
  return {
    dayIndex: 2,
    role: "full",
    theme: {
      id: "shopping",
      label: "Shopping",
      primaryTags: ["shopping"],
      secondaryTags: [],
      preferredExperienceTypes: ["shopping"],
    },
    goals: [{ type: "keep_energy_low" }],
    constraints: [],
    dayBudgetIntent: "either",
    capacity: rules.capacity,
    anchor: {
      landmarkName: anchor.name,
      role: "anchor",
      interestTags: anchor.interestTags,
      isPaid: anchor.adultPrice > 0,
    },
    support: [],
    meals: [],
  };
}

describe("long shopping + low-key pairing (FAM-84)", () => {
  const mall = landmark("Fashion Valley Mall", ["shopping"], {
    adultPrice: 0,
    intensity: "medium",
  });
  const playground = landmark("Neighborhood Playground", ["playgrounds"]);
  const museum = landmark("City Museum", ["museums"], { adultPrice: 18, indoor: true });

  const city: CityConfig = {
    ...CITY_CONFIGS.find((c) => c.id === "san-diego")!,
    id: "test-shopping",
    landmarks: [mall, playground, museum],
  };

  it("recognizes destination malls as long shopping experiences", () => {
    expect(isLongShoppingExperience(mall)).toBe(true);
    expect(pairingAllowedForDay(mall, playground)).toBe(true);
    expect(pairingAllowedForDay(mall, museum)).toBe(false);
  });

  it("selects a chill morning support stop on shopping days", () => {
    const trip = plan();
    const day = shoppingDay(mall);
    const support = selectSupportForDay(city, trip, day, mall, {
      ledgerNames: new Set([mall.name]),
      alreadyToday: [mall],
    });
    expect(support).toHaveLength(1);
    expect(support[0]!.name).toBe("Neighborhood Playground");
    expect(isChillDayCompanion(support[0]!)).toBe(true);
  });

  it("places the mall in the afternoon and chill support in the morning", () => {
    const trip = plan();
    const day = {
      ...shoppingDay(mall),
      support: [
        {
          landmarkName: playground.name,
          role: "support" as const,
          interestTags: playground.interestTags,
          isPaid: false,
        },
      ],
    };
    const { ctx, dropSlotKinds } = placementFromDayBlueprint(city, trip, day, new Set());
    expect(ctx.morning.name).toBe("Neighborhood Playground");
    expect(ctx.afternoon.name).toBe("Fashion Valley Mall");
    expect(dropSlotKinds).not.toContain("morning_activity");
  });
});

describe("theme park + low-key pairing (FAM-84)", () => {
  const trip = plan();
  const park = landmark("Adventure Theme Park", ["theme-parks"], {
    adultPrice: 55,
    intensity: "high",
    lat: 32.78,
    lng: -117.12,
  });
  const playground = landmark("Morning Playground", ["playgrounds"], {
    lat: trip.stayLat! + 0.003,
    lng: trip.stayLng!,
  });

  const city: CityConfig = {
    ...CITY_CONFIGS.find((c) => c.id === "san-diego")!,
    id: "test-theme-park",
    landmarks: [park, playground],
  };

  it("selects a chill morning support stop for theme park days", () => {
    const rules = emptyPlanningRules(trip);
    const day: DayBlueprint = {
      dayIndex: 2,
      role: "full",
      theme: {
        id: "theme_park",
        label: "Theme park",
        primaryTags: ["theme-parks"],
        secondaryTags: [],
        preferredExperienceTypes: ["theme-parks"],
      },
      goals: [{ type: "keep_energy_low" }],
      constraints: [{ type: "require_half_day_window" }],
      dayBudgetIntent: "paid",
      capacity: rules.capacity,
      anchor: {
        landmarkName: park.name,
        role: "anchor",
        interestTags: park.interestTags,
        isPaid: true,
      },
      support: [],
      meals: [],
    };
    const support = selectSupportForDay(city, trip, day, park, {
      ledgerNames: new Set([park.name]),
      alreadyToday: [park],
    });
    expect(support).toHaveLength(1);
    expect(support[0]!.name).toBe("Morning Playground");
    expect(isChillDayCompanion(support[0]!)).toBe(true);
  });

  const citySd = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
  const belmont = citySd.landmarks.find((l) => l.name === "Belmont Park")!;
  const boardwalk = citySd.landmarks.find((l) => l.name === "Mission Beach Boardwalk")!;

  it("schedules the park as afternoon hero after a chill morning stop", () => {
    const rules = emptyPlanningRules(trip);
    const day: DayBlueprint = {
      dayIndex: 2,
      role: "full",
      theme: {
        id: "theme_park",
        label: "Theme park",
        primaryTags: ["theme-parks"],
        secondaryTags: ["entertainment"],
        preferredExperienceTypes: ["theme-parks"],
      },
      goals: [{ type: "keep_energy_low" }, { type: "half_day_anchor" }],
      constraints: [{ type: "require_half_day_window" }],
      dayBudgetIntent: "paid",
      capacity: rules.capacity,
      anchor: {
        landmarkName: belmont.name,
        role: "anchor",
        interestTags: belmont.interestTags,
        isPaid: true,
      },
      support: [
        {
          landmarkName: boardwalk.name,
          role: "support",
          interestTags: boardwalk.interestTags,
          isPaid: false,
        },
      ],
      meals: [],
    };
    const { ctx } = placementFromDayBlueprint(citySd, trip, day, new Set());
    expect(ctx.morning.name).toBe("Mission Beach Boardwalk");
    expect(ctx.afternoon.name).toBe("Belmont Park");
  });
});
