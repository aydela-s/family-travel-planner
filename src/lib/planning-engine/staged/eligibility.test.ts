import { describe, expect, it } from "vitest";
import type { CityConfig, Landmark } from "@/config/city-pricing";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { compileTripConstraints } from "@/lib/planning-engine/constraints";
import { landmarkFromTopActivity } from "@/lib/maps/places-city-config";
import type { TopActivity } from "@/lib/maps/get-top-activities";
import {
  isEligibleStop,
  stopRejection,
  violatesAgeRestriction,
} from "@/lib/planning-engine/staged/eligibility";
import { emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
import { selectAnchorForDay } from "@/lib/planning-engine/staged/anchor-selector";
import type { DayBlueprint } from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";
import type { PlannerConflict } from "@/lib/planning-engine/conflicts";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Test City",
    startDate: "2026-08-11", // Tuesday
    endDate: "2026-08-13",
    adults: 1,
    children: [3],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    stayAddress: "Stay",
    stayLat: 32.72,
    stayLng: -117.16,
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Parks & Gardens"],
    ...overrides,
  };
}

function landmark(partial: Partial<Landmark> & Pick<Landmark, "name">): Landmark {
  return {
    lat: 32.72,
    lng: -117.16,
    adultPrice: 0,
    openingHours: { open: "09:00", close: "18:00" },
    intensity: "low",
    ageTags: ["toddler", "child", "tween", "teen"],
    interestTags: ["parks"],
    indoor: false,
    ...partial,
  };
}

function cityWith(landmarks: Landmark[]): CityConfig {
  return { ...CITY_CONFIGS[0]!, id: "eligibility-test", landmarks, restaurants: [] };
}

function fullDay(trip: TripPlan): DayBlueprint {
  const rules = emptyPlanningRules(trip);
  return {
    dayIndex: 1,
    date: trip.startDate,
    role: "full",
    theme: {
      id: "mixed_family",
      label: "Family",
      primaryTags: ["parks"],
      secondaryTags: [],
      preferredExperienceTypes: ["parks"],
    },
    goals: [],
    constraints: [],
    dayBudgetIntent: "either",
    capacity: rules.capacity,
    support: [],
    meals: [],
  };
}

const tuesdayMorning = {
  startMin: 10 * 60,
  endMin: 12 * 60,
  visitDate: "2026-08-11",
};

describe("hard age restrictions vs soft age tags", () => {
  it("excludes a venue whose minAge the family's children do not meet", () => {
    expect(violatesAgeRestriction({ minAge: 8 }, plan({ children: [3] }))).toBe(true);
    expect(
      stopRejection(landmark({ name: "Climbing Gym", minAge: 8 }), {
        plan: plan({ children: [3] }),
      })?.rule,
    ).toBe("age_restriction");
  });

  it("excludes a venue whose maxAge a child exceeds", () => {
    expect(violatesAgeRestriction({ maxAge: 5 }, plan({ children: [8] }))).toBe(true);
  });

  it("does not treat 'best for tweens' age tags as a hard exclusion", () => {
    const venue = landmark({
      name: "Tween Arcade",
      ageTags: ["tween", "teen"],
    });
    expect(violatesAgeRestriction(venue, plan({ children: [3] }))).toBe(false);
    expect(isEligibleStop(venue, { plan: plan({ children: [3] }) })).toBe(true);
  });

  it("never invents minAge / maxAge from Places name or type heuristics", () => {
    const place: TopActivity = {
      id: "places/arcade",
      name: "Laser Tag Arena",
      rating: 4.6,
      reviewCount: 400,
      priceLevel: "PRICE_LEVEL_MODERATE",
      address: "1 Main",
      latitude: 32.78,
      longitude: -96.8,
      photoRef: null,
      score: 40,
      types: ["amusement_center"],
      primaryType: "amusement_center",
      websiteUri: null,
      hoursByWeekday: null,
    };
    const mapped = landmarkFromTopActivity(place, ["entertainment"]);
    expect(mapped?.minAge).toBeUndefined();
    expect(mapped?.maxAge).toBeUndefined();
    expect(mapped?.hoursConfidence).toBe("assumed");
  });
});

describe("opening-hours hard filter", () => {
  const closedTuesday = landmark({
    name: "Tuesday-closed Museum",
    interestTags: ["parks"],
    hoursByWeekday: { 2: null },
    openingHours: { open: "09:00", close: "17:00" },
  });
  const openPark = landmark({
    name: "Always Open Park",
    lat: 32.73,
    lng: -117.16,
    openingHours: { open: "08:00", close: "20:00" },
  });

  it("excludes a reliable weekday-closed venue", () => {
    expect(
      stopRejection(closedTuesday, {
        plan: plan(),
        visitWindow: tuesdayMorning,
      })?.rule,
    ).toBe("venue_closed");
  });

  it("excludes a reliable venue whose open window does not overlap the visit at all", () => {
    const eveningOnly = landmark({
      name: "Night Market",
      openingHours: { open: "18:00", close: "22:00" },
    });
    expect(
      stopRejection(eveningOnly, {
        plan: plan(),
        visitWindow: tuesdayMorning,
      })?.rule,
    ).toBe("venue_closed");
  });

  it("keeps assumed-hours and unknown-hours venues eligible", () => {
    const assumed = landmark({
      name: "Guessed Hours Park",
      openingHours: { open: "18:00", close: "19:00" },
      hoursConfidence: "assumed",
    });
    const unknownHoursRestaurantLike = landmark({
      name: "No Hours Park",
      openingHours: { open: "00:00", close: "23:59" },
      hoursConfidence: "assumed",
    });
    expect(isEligibleStop(assumed, { plan: plan(), visitWindow: tuesdayMorning })).toBe(true);
    expect(
      isEligibleStop(unknownHoursRestaurantLike, {
        plan: plan(),
        visitWindow: tuesdayMorning,
      }),
    ).toBe(true);
  });

  it("picks an open alternative instead of a higher-scoring closed venue", () => {
    const city = cityWith([closedTuesday, openPark]);
    const trip = plan();
    const pick = selectAnchorForDay(city, trip, fullDay(trip), {
      visitWindow: tuesdayMorning,
      ledgerNames: new Set(),
      constraints: compileTripConstraints(trip),
    });
    expect(pick.name).toBe("Always Open Park");
  });

  it("still schedules an assumed-hours venue when it is the only candidate", () => {
    const assumed = landmark({
      name: "Only Park",
      openingHours: { open: "18:00", close: "19:00" },
      hoursConfidence: "assumed",
    });
    const city = cityWith([assumed]);
    const trip = plan();
    const pick = selectAnchorForDay(city, trip, fullDay(trip), {
      visitWindow: tuesdayMorning,
      ledgerNames: new Set(),
      constraints: compileTripConstraints(trip),
    });
    expect(pick.name).toBe("Only Park");
  });
});

describe("explicit user hard constraints", () => {
  it("never selects an excluded venue", () => {
    const banned = landmark({ name: "Play Street Museum" });
    const other = landmark({ name: "Klyde Warren Park", lat: 32.73 });
    const city = cityWith([banned, other]);
    const trip = plan({
      userConstraints: { excludeVenues: ["Play Street Museum"] },
    });
    const pick = selectAnchorForDay(city, trip, fullDay(trip), {
      ledgerNames: new Set(),
      constraints: compileTripConstraints(trip),
    });
    expect(pick.name).toBe("Klyde Warren Park");
  });

  it("never selects an excluded interest", () => {
    const themePark = landmark({
      name: "Six Flags",
      interestTags: ["theme-parks"],
      intensity: "high",
      adultPrice: 80,
    });
    const park = landmark({ name: "City Park" });
    const city = cityWith([themePark, park]);
    const trip = plan({
      interests: ["Theme Parks", "Parks & Gardens"],
      userConstraints: { excludeInterests: ["Theme Parks"] },
    });
    const pick = selectAnchorForDay(city, trip, fullDay(trip), {
      ledgerNames: new Set(),
      constraints: compileTripConstraints(trip),
    });
    expect(pick.name).toBe("City Park");
    expect(pick.interestTags).not.toContain("theme-parks");
  });

  it("records a conflict instead of silently using the only excluded venue", () => {
    const banned = landmark({ name: "Only Stop" });
    const city = cityWith([banned]);
    const trip = plan({ userConstraints: { excludeVenues: ["Only Stop"] } });
    const conflicts: PlannerConflict[] = [];
    const pick = selectAnchorForDay(city, trip, fullDay(trip), {
      ledgerNames: new Set(),
      constraints: compileTripConstraints(trip),
      conflicts,
    });
    expect(pick.name).toBe("Only Stop");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.rule).toBe("exclude_venue");
    expect(conflicts[0]!.chosen?.name).toBe("Only Stop");
    expect(conflicts[0]!.options[0]!.violates).toContain("exclude_venue");
  });

  it("rejects a stop beyond an explicit max drive time", () => {
    const far = landmark({
      name: "Far Park",
      lat: 33.2,
      lng: -117.16,
    });
    const trip = plan({ userConstraints: { maxDriveMin: 10 } });
    expect(
      stopRejection(far, {
        plan: trip,
        constraints: compileTripConstraints(trip),
      })?.rule,
    ).toBe("max_drive_min");
  });
});
