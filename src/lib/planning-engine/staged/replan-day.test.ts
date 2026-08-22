import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import { pairingAllowedForDay } from "@/lib/planning-engine/staged/landmark-experience";
import { pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import type { TripPlan } from "@/types/trip-plan";

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

function sdPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 2,
    children: [6, 9],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [
      "Interactive Museums",
      "Zoos & Aquariums",
      "Parks & Gardens",
      "Theme Parks",
    ],
    ...overrides,
  };
}

describe("staged adjust-note replan (FAM-84 phase 5)", () => {
  it("replanStagedDayWithNote runs on the default staged engine, not score", () => {
    const trip = sdPlan();
    const initial = planTrip(trip, { cityOverride: city });
    expect(initial.plannerEngine).toBe("staged");

    const adjusted = planTrip(trip, {
      cityOverride: city,
      adjustDay: 3,
      adjustNote: "more outdoor parks and nature",
      existingItinerary: initial.raw,
    });

    expect(adjusted.plannerEngine).toBe("staged");
    const after = adjusted.raw.days.find((d) => d.day === 3)!.activities;
    expect(after.length).toBeGreaterThan(0);
    expect(after.some((a) => /outdoor focus/i.test(a.title))).toBe(true);
    expect(initial.raw.days[0]!.activities).toEqual(
      adjusted.raw.days[0]!.activities,
    );
  });
});

describe("score path hard-rule filters in pickLandmarkForFamily", () => {
  it("does not pair two heavy anchors on the same day", () => {
    const trip = sdPlan();
    const zoo = city.landmarks.find((l) => l.name === "San Diego Zoo")!;
    const afternoon = pickLandmarkForFamily(city, trip, 2, 1, [zoo], {
      slotIndex: 1,
      applyInterestGates: true,
    });
    expect(pairingAllowedForDay(zoo, afternoon)).toBe(true);
  });
});
