import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import {
  activityTitlesByDay,
  fingerprintRawItinerary,
  resolvePlannerEngine,
} from "@/lib/planning-engine/staged";
import { TripPlan } from "@/types/trip-plan";

/** Canonical multi-interest SD trip used for score↔staged regression diffs. */
export function goldenSanDiegoPlan(): TripPlan {
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
  };
}

describe("golden fixture harness (Phase 0)", () => {
  it("defaults to the staged engine", () => {
    expect(resolvePlannerEngine()).toBe("staged");
  });

  it("produces a stable fingerprint shape for the canonical SD trip", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const { raw, plannerEngine, blueprint } = planTrip(goldenSanDiegoPlan(), {
      cityOverride: sanDiego,
    });

    expect(plannerEngine).toBe("staged");
    expect(raw.days).toHaveLength(5);
    expect(blueprint).toBeDefined();
    expect(blueprint!.days[0]!.role).toBe("arrival");
    expect(blueprint!.days[0]!.theme.id).toBe("arrival");
    expect(blueprint!.days[4]!.theme.id).toBe("departure");
    expect(blueprint!.days.every((d) => d.anchor)).toBe(true);
    expect(blueprint!.experienceCoverage.items.length).toBeGreaterThan(0);

    const fingerprint = fingerprintRawItinerary(raw);
    expect(fingerprint.days).toHaveLength(5);
    for (const day of fingerprint.days) {
      expect(day.items.length).toBeGreaterThan(0);
      expect(day.items.some((i) => i.type === "meal")).toBe(true);
    }

    const activities = activityTitlesByDay(raw);
    expect(activities.every((titles) => titles.length >= 1)).toBe(true);
  });
});
