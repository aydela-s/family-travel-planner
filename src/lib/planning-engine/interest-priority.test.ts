import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type CityConfig, type Landmark } from "@/config/city-pricing";
import { buildTripStrategy } from "@/lib/planning-engine/staged";
import { selectAnchorForDay, selectSoftFiller } from "@/lib/planning-engine/staged/anchor-selector";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import {
  buildExperienceCoverageTargets,
  markExperienceCompletedByKeys,
} from "@/lib/planning-engine/staged/experience-coverage";
import type { TripPlan } from "@/types/trip-plan";

/**
 * The rule under test: uncovered selected interests are filled before anything
 * else, and an unselected category is only allowed once no uncovered selected
 * interest has a viable candidate. Fixtures are synthetic so "viable" is
 * unambiguous — every candidate is free, open all day, and equally close.
 */

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Testville",
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    adults: 2,
    children: [6, 9],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    stayLat: 39.74,
    stayLng: -104.99,
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Interactive Museums", "Swimming & Water Play"],
    ...overrides,
  };
}

/** ~0.009° latitude ≈ 1 km north of the stay. */
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

const anchor = landmark("Hands-On Discovery Lab", ["interactive"], 1, { indoor: true });
/** Satisfies the still-uncovered "Swimming & Water Play" interest. */
const selectedCandidate = landmark("Splash Aquatic Center", ["beaches"], 2);
/** Not in the family's interests at all. */
const unselectedCandidate = landmark("Rose Garden", ["parks"], 1.5);

function cityWith(landmarks: Landmark[]): CityConfig {
  return { ...CITY_CONFIGS[0]!, id: "test-city", landmarks };
}

function fullDay(trip: TripPlan, city: CityConfig) {
  const strategy = buildTripStrategy(trip, { city });
  const day = strategy.days.find((d) => d.role === "full") ?? strategy.days[0]!;
  return { ...day, support: [], meals: [] };
}

describe("uncovered selected interests come before unselected categories", () => {
  it("fills a support slot from an uncovered selected interest", () => {
    // Packed so the day's load budget fits both candidates and the only
    // difference between them is whether the family asked for that interest.
    const trip = plan({ travelStyle: "packed" });
    const city = cityWith([anchor, selectedCandidate, unselectedCandidate]);
    const support = selectSupportForDay(city, trip, fullDay(trip, city), anchor, {
      ledgerNames: new Set(),
      alreadyToday: [anchor],
      uncoveredSelectedTags: ["beaches"],
    });
    expect(support.map((l) => l.name)).toContain("Splash Aquatic Center");
    expect(support.map((l) => l.name)).not.toContain("Rose Garden");
  });

  it("keeps an uncovered selected interest even when it is a heavier stop", () => {
    // HARD RULE: never schedule an unselected category while a selected interest
    // still has an unused candidate — even if that candidate is a heavier day load.
    const trip = plan();
    const city = cityWith([anchor, selectedCandidate, unselectedCandidate]);
    const support = selectSupportForDay(city, trip, fullDay(trip, city), anchor, {
      ledgerNames: new Set(),
      alreadyToday: [anchor],
      uncoveredSelectedTags: ["beaches"],
    });
    expect(support.map((l) => l.name)).toEqual(["Splash Aquatic Center"]);
    expect(support.map((l) => l.name)).not.toContain("Rose Garden");
  });

  it("falls back to an unselected category only when the selected one has no candidate", () => {
    const trip = plan();
    const city = cityWith([anchor, unselectedCandidate]);
    const support = selectSupportForDay(city, trip, fullDay(trip, city), anchor, {
      ledgerNames: new Set(),
      alreadyToday: [anchor],
      uncoveredSelectedTags: ["beaches"],
    });
    // Nothing satisfies "Swimming & Water Play" in this city, so the park is fair game.
    expect(support.map((l) => l.name)).toEqual(["Rose Garden"]);
  });

  it("does not take an unselected category when the selected candidate is merely farther", () => {
    const trip = plan({ travelStyle: "packed" });
    const city = cityWith([
      anchor,
      landmark("Distant Aquatic Center", ["beaches"], 9),
      landmark("Park Next Door", ["parks"], 1.1),
    ]);
    const support = selectSupportForDay(city, trip, fullDay(trip, city), anchor, {
      ledgerNames: new Set(),
      alreadyToday: [anchor],
      uncoveredSelectedTags: ["beaches"],
    });
    expect(support.map((l) => l.name)).toEqual(["Distant Aquatic Center"]);
  });

  it("prefers an uncovered interest over one the trip already covered", () => {
    const trip = plan({
      interests: ["Interactive Museums", "Swimming & Water Play", "Shopping"],
      travelStyle: "packed",
    });
    const city = cityWith([
      anchor,
      selectedCandidate,
      landmark("Second Discovery Lab", ["interactive"], 1.2, { indoor: true }),
    ]);
    const support = selectSupportForDay(city, trip, fullDay(trip, city), anchor, {
      ledgerNames: new Set(),
      alreadyToday: [anchor],
      uncoveredSelectedTags: ["beaches"],
    });
    expect(support.map((l) => l.name)).toContain("Splash Aquatic Center");
  });

  it("applies the same priority to soft filler stops", () => {
    const trip = plan();
    const city = cityWith([anchor, selectedCandidate, unselectedCandidate]);
    const filler = selectSoftFiller(
      city,
      trip,
      fullDay(trip, city),
      anchor,
      new Set(),
      undefined,
      [anchor],
      { uncoveredSelectedTags: ["beaches"] },
    );
    expect(filler?.name).toBe("Splash Aquatic Center");
  });

  it("lets soft filler use an unselected category when no selected one remains", () => {
    const trip = plan();
    const city = cityWith([anchor, unselectedCandidate]);
    const filler = selectSoftFiller(
      city,
      trip,
      fullDay(trip, city),
      anchor,
      new Set(),
      undefined,
      [anchor],
      { uncoveredSelectedTags: ["beaches"] },
    );
    expect(filler?.name).toBe("Rose Garden");
  });
});

describe("anchor-level interest coverage (FAM-84 rules 9–10)", () => {
  const museumAnchor = landmark("Hands-On Discovery Lab", ["interactive"], 1, { indoor: true });
  const museumAlt = landmark("City Art Museum", ["museums"], 1.1, { indoor: true });
  const parksAlt = landmark("Neighborhood Park", ["parks"], 1.2);

  it("picks an uncovered selected interest over an unselected category", () => {
    const trip = plan({ interests: ["Interactive Museums", "Museums & Art"] });
    const city = cityWith([museumAnchor, museumAlt, parksAlt]);
    const day = fullDay(trip, city);
    const anchor = selectAnchorForDay(city, trip, day, {
      ledgerNames: new Set(),
      interestCoverage: buildExperienceCoverageTargets(trip, 4),
    });
    expect(anchor.interestTags.some((t) => ["interactive", "museums"].includes(t))).toBe(true);
    expect(anchor.name).not.toBe("Neighborhood Park");
  });

  it("does not assign a second parks day before museums has an anchor", () => {
    const trip = plan({ interests: ["Parks & Gardens", "Museums & Art"] });
    let coverage = buildExperienceCoverageTargets(trip, 4);
    coverage = markExperienceCompletedByKeys(coverage, ["parks"]);
    const city = cityWith([
      landmark("First Park", ["parks"], 1),
      parksAlt,
      museumAlt,
    ]);
    const day = fullDay(trip, city);
    const anchor = selectAnchorForDay(city, trip, day, {
      ledgerNames: new Set(["First Park"]),
      interestCoverage: coverage,
    });
    expect(anchor.name).toBe("City Art Museum");
  });
});
