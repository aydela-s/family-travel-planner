import { describe, expect, it } from "vitest";
import {
  INTEREST_LABEL_TO_TAGS,
  interestTagsFromPlan,
  normalizeInterestLabels,
} from "@/lib/schedule/interest-map";
import {
  buildExperienceCoverageTargets,
  coverageEntriesFromInterests,
  markExperienceCompleted,
} from "@/lib/planning-engine/staged/experience-coverage";
import type { TripPlan } from "@/types/trip-plan";

function plan(interests: string[]): TripPlan {
  return {
    destination: "Testville",
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    adults: 2,
    children: [6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests,
  };
}

describe("interest taxonomy — distinct catalog tags", () => {
  it("keeps Zoos & Aquariums and Animal Experiences on separate tags", () => {
    expect(INTEREST_LABEL_TO_TAGS["Zoos & Aquariums"]).toEqual(["zoos"]);
    expect(INTEREST_LABEL_TO_TAGS["Animal Experiences"]).toEqual(["animal-experiences"]);
    expect(interestTagsFromPlan(["Zoos & Aquariums", "Animal Experiences"]).sort()).toEqual(
      ["animal-experiences", "zoos"].sort(),
    );
  });

  it("keeps History & Landmarks and Tours & Sightseeing on separate tags", () => {
    expect(INTEREST_LABEL_TO_TAGS["History & Landmarks"]).toEqual(["history"]);
    expect(INTEREST_LABEL_TO_TAGS["Tours & Sightseeing"]).toEqual(["tours"]);
    expect(interestTagsFromPlan(["History & Landmarks", "Tours & Sightseeing"]).sort()).toEqual(
      ["history", "tours"].sort(),
    );
  });
});

describe("interest taxonomy — paired coverage must be separate", () => {
  it("requires a zoo stop and an animal-experience stop when both interests are selected", () => {
    const coverage = buildExperienceCoverageTargets(
      plan(["Zoos & Aquariums", "Animal Experiences"]),
      4,
    );
    const keys = coverage.items.map((i) => i.key).sort();
    expect(keys).toEqual(["animal-experiences", "zoos"]);

    const afterZoo = markExperienceCompleted(coverage, ["zoos"]);
    const zooItem = afterZoo.items.find((i) => i.tag === "zoos")!;
    const animalItem = afterZoo.items.find((i) => i.tag === "animal-experiences")!;
    expect(zooItem.completed).toBeGreaterThan(0);
    expect(animalItem.completed).toBe(0);
  });

  it("requires a landmark stop and a tour stop when both interests are selected", () => {
    const entries = coverageEntriesFromInterests([
      "History & Landmarks",
      "Tours & Sightseeing",
    ]);
    expect(entries.map((e) => e.tag).sort()).toEqual(["history", "tours"].sort());

    const coverage = buildExperienceCoverageTargets(
      plan(["History & Landmarks", "Tours & Sightseeing"]),
      4,
    );
    const afterTour = markExperienceCompleted(coverage, ["tours"]);
    expect(afterTour.items.find((i) => i.tag === "tours")!.completed).toBeGreaterThan(0);
    expect(afterTour.items.find((i) => i.tag === "history")!.completed).toBe(0);
  });
});

describe("interest taxonomy — legacy label compatibility", () => {
  it("still maps saved-trip labels to catalog tags", () => {
    expect(interestTagsFromPlan(["Beaches & Waterfronts"])).toEqual(["beaches"]);
    expect(interestTagsFromPlan(["Playgrounds & Indoor Play"]).sort()).toEqual(
      ["indoor-play", "playgrounds"].sort(),
    );
    expect(interestTagsFromPlan(["Playgrounds"]).sort()).toEqual(
      ["indoor-play", "playgrounds"].sort(),
    );
  });

  it("normalizes legacy labels to canonical wizard names", () => {
    expect(
      normalizeInterestLabels([
        "Beaches & Waterfronts",
        "Playgrounds & Indoor Play",
        "Zoos & Aquariums",
      ]),
    ).toEqual(["Swimming & Water Play", "Indoor & Outdoor Play", "Zoos & Aquariums"]);
  });
});
