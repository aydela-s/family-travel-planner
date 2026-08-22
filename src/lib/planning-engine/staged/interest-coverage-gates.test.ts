import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type CityConfig, type Landmark } from "@/config/city-pricing";
import { compileTripConstraints } from "@/lib/planning-engine/constraints";
import {
  applyDailyThemes,
  buildExperienceCoverageTargets,
  buildTripStrategy,
  commitStopsToBlueprint,
  markExperienceCompletedByKeys,
} from "@/lib/planning-engine/staged";
import { selectAnchorForDay } from "@/lib/planning-engine/staged/anchor-selector";
import {
  anchorRepeatsBeforeFullCoverage,
  filterAnchorsByInterestCoverage,
} from "@/lib/planning-engine/staged/interest-coverage-gates";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Testville",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
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
    interests: ["Parks & Gardens", "Museums & Art"],
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

describe("interest coverage gates (FAM-84 rules 9–10)", () => {
  const parksA = landmark("Riverside Park", ["parks"], 1);
  const parksB = landmark("Hilltop Park", ["parks"], 1.2);
  const museum = landmark("City History Museum", ["museums"], 1.1, { indoor: true });

  it("detects when an anchor would repeat before first coverage", () => {
    const trip = plan();
    let coverage = buildExperienceCoverageTargets(trip, 4);
    coverage = markExperienceCompletedByKeys(coverage, ["parks"]);
    const selected = new Set(interestTagsFromPlan(trip.interests));
    expect(anchorRepeatsBeforeFullCoverage(parksB, coverage, selected)).toBe(true);
    expect(anchorRepeatsBeforeFullCoverage(museum, coverage, selected)).toBe(false);
  });

  it("filters repeat anchors when an awaiting interest still has candidates", () => {
    const trip = plan();
    let coverage = buildExperienceCoverageTargets(trip, 4);
    coverage = markExperienceCompletedByKeys(coverage, ["parks"]);
    const city = cityWith([parksA, parksB, museum]);
    const filtered = filterAnchorsByInterestCoverage(
      [parksA, parksB, museum],
      trip,
      coverage,
      city,
      {
        excludeNames: new Set(["Riverside Park"]),
        constraints: compileTripConstraints(trip),
        applyGates: true,
      },
    );
    expect(filtered.map((l) => l.name)).toEqual(["City History Museum"]);
  });

  it("selectAnchorForDay prefers an awaiting interest over a repeat", () => {
    const trip = plan();
    let coverage = buildExperienceCoverageTargets(trip, 4);
    coverage = markExperienceCompletedByKeys(coverage, ["parks"]);
    const city = cityWith([parksB, museum]);
    const strategy = buildTripStrategy(trip, { city });
    const day = strategy.days.find((d) => d.role === "full") ?? strategy.days[1]!;
    const anchor = selectAnchorForDay(city, trip, day, {
      ledgerNames: new Set(["Riverside Park"]),
      interestCoverage: coverage,
    });
    expect(anchor.name).toBe("City History Museum");
  });

  it("schedules each selected interest once before any repeat across full days", () => {
    const trip = plan({
      endDate: "2026-09-20",
      interests: ["Parks & Gardens", "Museums & Art", "Interactive Museums"],
    });
    const city = cityWith([
      landmark("Discovery Lab", ["interactive"], 1, { indoor: true }),
      landmark("Art Walk Museum", ["museums"], 1.1, { indoor: true }),
      landmark("Meadow Park", ["parks"], 1.2),
      landmark("Second Meadow", ["parks"], 1.3),
      landmark("Second Lab", ["interactive"], 1.4, { indoor: true }),
      landmark("History Hall", ["museums"], 1.5, { indoor: true }),
    ]);
    const themed = applyDailyThemes(buildTripStrategy(trip, { city }), trip, city);
    const committed = commitStopsToBlueprint(themed, trip, city);

    const anchorTagsByDay = committed.days
      .filter((d) => d.role === "full" && d.anchor)
      .map((d) =>
        d.anchor!.interestTags.filter((t) =>
          interestTagsFromPlan(trip.interests).includes(t),
        ),
      );

    const selectedTags = interestTagsFromPlan(trip.interests);
    const firstCoverage = new Set<string>();
    let repeatBeforeAllFirst = false;
    for (const dayTags of anchorTagsByDay) {
      for (const tag of dayTags) {
        if (!selectedTags.includes(tag)) continue;
        if (firstCoverage.has(tag) && firstCoverage.size < selectedTags.length) {
          repeatBeforeAllFirst = true;
        }
        firstCoverage.add(tag);
      }
    }

    expect(
      repeatBeforeAllFirst,
      anchorTagsByDay.map((t, i) => `day${i + 1}:${t.join(",")}`).join(" | "),
    ).toBe(false);
    expect(new Set(anchorTagsByDay.flat()).size).toBeGreaterThanOrEqual(3);
  });

});
