import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type Landmark } from "@/config/city-pricing";
import { compileTripConstraints } from "@/lib/planning-engine/constraints";
import { filterScoreLandmarkCandidates } from "@/lib/planning-engine/score-hard-rules";
import {
  buildExperienceCoverageTargets,
} from "@/lib/planning-engine/staged/experience-coverage";
import {
  isThemeParkExperience,
  pairingAllowedForDay,
} from "@/lib/planning-engine/staged/landmark-experience";
import type { TripPlan } from "@/types/trip-plan";

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
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
    interests: ["Theme Parks", "Interactive Museums", "Parks & Gardens"],
    ...overrides,
  };
}

describe("filterScoreLandmarkCandidates (FAM-84 score path parity)", () => {
  it("morning slot excludes theme parks and long shopping", () => {
    const themePark = city.landmarks.find((l) => isThemeParkExperience(l))!;
    const park = city.landmarks.find((l) => l.name === "Balboa Park")!;
    const filtered = filterScoreLandmarkCandidates([themePark, park], {
      plan: plan(),
      city,
      constraints: compileTripConstraints(plan()),
      alreadyPicked: [],
      excludeNames: new Set(),
      slotIndex: 0,
    });
    expect(filtered.some((l) => isThemeParkExperience(l))).toBe(false);
    expect(filtered).toContainEqual(park);
  });

  it("afternoon pick must pair with the morning theme park (no second heavy stop)", () => {
    const themePark = city.landmarks.find((l) => isThemeParkExperience(l))!;
    const zoo = city.landmarks.find((l) => l.name === "San Diego Zoo")!;
    const filtered = filterScoreLandmarkCandidates([zoo, ...city.landmarks], {
      plan: plan(),
      city,
      constraints: compileTripConstraints(plan()),
      alreadyPicked: [themePark],
      excludeNames: new Set(),
      slotIndex: 1,
    });
    expect(filtered.map((l) => l.name)).not.toContain("San Diego Zoo");
    expect(filtered.every((l) => pairingAllowedForDay(themePark, l))).toBe(true);
  });

  it("drops reliably closed landmarks for the visit window", () => {
    const closedMonday: Landmark = {
      name: "Closed Monday Museum",
      lat: 32.72,
      lng: -117.16,
      adultPrice: 20,
      intensity: "medium",
      ageTags: ["child"],
      interestTags: ["museums"],
      indoor: true,
      openingHours: { open: "10:00", close: "17:00" },
      hoursByWeekday: {
        0: { open: "10:00", close: "17:00" },
        1: null,
        2: { open: "10:00", close: "17:00" },
        3: { open: "10:00", close: "17:00" },
        4: { open: "10:00", close: "17:00" },
        5: { open: "10:00", close: "17:00" },
        6: { open: "10:00", close: "17:00" },
      },
      hoursConfidence: "verified",
    };
    const openPark: Landmark = {
      name: "Open Park Nearby",
      lat: 32.721,
      lng: -117.161,
      adultPrice: 0,
      intensity: "low",
      ageTags: ["child"],
      interestTags: ["parks"],
      indoor: false,
      openingHours: { open: "08:00", close: "20:00" },
    };
    const testCity = { ...city, landmarks: [closedMonday, openPark] };
    const filtered = filterScoreLandmarkCandidates([closedMonday, openPark], {
      plan: plan({ startDate: "2026-09-14", endDate: "2026-09-14" }),
      city: testCity,
      constraints: compileTripConstraints(plan()),
      visitWindow: {
        startMin: 10 * 60,
        endMin: 12 * 60,
        visitDate: "2026-09-14",
      },
      alreadyPicked: [],
      excludeNames: new Set(),
      slotIndex: 0,
    });
    expect(filtered.map((l) => l.name)).toEqual(["Open Park Nearby"]);
  });

  it("prefers uncovered interests before repeating a covered tag", () => {
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;
    const zoo = city.landmarks.find((l) => l.name === "San Diego Zoo")!;
    let coverage = buildExperienceCoverageTargets(
      plan({ interests: ["Interactive Museums", "Zoos & Aquariums"] }),
      5,
    );
    coverage = {
      items: coverage.items.map((item) =>
        item.tag === "interactive" ? { ...item, completed: 1 } : item,
      ),
    };
    const filtered = filterScoreLandmarkCandidates([fleet, zoo], {
      plan: plan({ interests: ["Interactive Museums", "Zoos & Aquariums"] }),
      city,
      constraints: compileTripConstraints(plan()),
      coverage,
      applyInterestGates: true,
      alreadyPicked: [],
      excludeNames: new Set(),
      slotIndex: 0,
    });
    expect(filtered.map((l) => l.name)).toContain("San Diego Zoo");
    expect(filtered.map((l) => l.name)).not.toContain("Fleet Science Center");
  });
});
