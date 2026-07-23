import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, Landmark } from "@/config/city-pricing";
import { buildLandmarkContext } from "@/lib/planning-engine/slot-filler";
import {
  extractLandmarkFromTitle,
  findLandmarkByName,
} from "@/lib/schedule/landmark-hours";
import {
  getFamilyAgeProfile,
  landmarkAgeScore,
  landmarkInterestScore,
  pickLandmarkForFamily,
  stayProximityScore,
  uncoveredAgeBands,
  walkingFitScore,
} from "@/lib/schedule/family-profile";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function landmark(
  partial: Partial<Landmark> & Pick<Landmark, "name" | "ageTags">,
): Landmark {
  return {
    lat: 32.72,
    lng: -117.16,
    adultPrice: 0,
    openingHours: { open: "09:00", close: "18:00" },
    intensity: "medium",
    indoor: false,
    interestTags: [],
    ...partial,
  };
}

describe("FAM-7 — mixed-age band coverage", () => {
  it("profiles ages 17, 8, and 3 into teen, tween, and toddler bands", () => {
    const profile = getFamilyAgeProfile(basePlan({ children: [17, 8, 3] }));
    expect(profile.bands).toEqual(["toddler", "tween", "teen"]);
    expect(profile.isMixedAges).toBe(true);
    expect(profile.hasYoungChild).toBe(false);
  });

  it("penalizes teen-only stops hard for a toddler+teen mixed family", () => {
    const profile = getFamilyAgeProfile(basePlan({ children: [17, 8, 3] }));
    const teenOnly = landmark({ name: "Teen Spot", ageTags: ["teen"] });
    const allAges = landmark({
      name: "Family Park",
      ageTags: ["toddler", "child", "tween", "teen"],
    });
    expect(landmarkAgeScore(allAges, profile)).toBeGreaterThan(
      landmarkAgeScore(teenOnly, profile),
    );
  });

  it("uncoveredAgeBands lists bands missing from already-picked stops", () => {
    const profile = getFamilyAgeProfile(basePlan({ children: [17, 8, 3] }));
    const teenStop = landmark({ name: "USS", ageTags: ["tween", "teen"] });
    expect(uncoveredAgeBands(profile, [teenStop])).toEqual(["toddler"]);
  });

  it("buildLandmarkContext diversifies morning/afternoon age tags for mixed ages", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const plan = basePlan({
      children: [17, 8, 3],
      budgetStyle: "splurge",
    });
    const ctx = buildLandmarkContext(sanDiego, plan, 1, 2);
    const covered = new Set([...ctx.morning.ageTags, ...ctx.afternoon.ageTags]);
    // Prefer covering at least two of the three family bands across the two stops.
    const familyBands = ["toddler", "tween", "teen"] as const;
    const hit = familyBands.filter((b) => covered.has(b)).length;
    expect(hit).toBeGreaterThanOrEqual(2);
    expect(ctx.morning.name).not.toBe(ctx.afternoon.name);
  });
});

describe("FAM-7 — interest matching", () => {
  it("maps wizard interest labels to catalog tags", () => {
    expect(interestTagsFromPlan(["Museums & Art", "Zoos & Aquariums"])).toEqual([
      "museums",
      "zoos",
    ]);
  });

  it("scores interest hits positively and misses negatively", () => {
    const plan = basePlan({ interests: ["Zoos & Aquariums"] });
    const zoo = landmark({
      name: "Zoo",
      ageTags: ["child"],
      interestTags: ["zoos"],
    });
    const beach = landmark({
      name: "Beach",
      ageTags: ["child"],
      interestTags: ["beaches"],
    });
    expect(landmarkInterestScore(zoo, plan)).toBeGreaterThan(
      landmarkInterestScore(beach, plan),
    );
    expect(landmarkInterestScore(beach, plan)).toBeLessThan(0);
  });

  it("pickLandmarkForFamily prefers zoo when Zoos & Aquariums is selected", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const plan = basePlan({
      children: [5],
      interests: ["Zoos & Aquariums"],
      budgetStyle: "splurge",
    });
    const pick = pickLandmarkForFamily(sanDiego, plan, 1, 0, [], {
      preferBand: "child",
    });
    expect(pick.interestTags).toContain("zoos");
    expect(pick.name).toBe("San Diego Zoo");
  });
});

describe("FAM-7 — stay proximity", () => {
  it("scores landmarks near stay higher than distant ones", () => {
    const plan = basePlan({
      stayLat: 32.7341,
      stayLng: -117.1446,
    });
    const near = landmark({
      name: "Near Stay",
      ageTags: ["child"],
      lat: 32.735,
      lng: -117.145,
    });
    const far = landmark({
      name: "Far Stay",
      ageTags: ["child"],
      lat: 32.85,
      lng: -117.27,
    });
    expect(stayProximityScore(near, plan)).toBeGreaterThan(stayProximityScore(far, plan));
  });

  it("anchors first pick near stay when stay coords exist", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    // Stay near Balboa / Zoo / Fleet cluster (downtown park area).
    const plan = basePlan({
      children: [6],
      stayLat: 32.7341,
      stayLng: -117.1446,
      budgetStyle: "splurge",
    });
    const pick = pickLandmarkForFamily(sanDiego, plan, 1, 0, [], {
      anchorToStay: true,
    });
    expect(["Balboa Park", "San Diego Zoo", "Fleet Science Center"]).toContain(pick.name);
  });
});

describe("FAM-7 — walking limit", () => {
  it("prefers low-intensity landmarks when walkingLimit is low", () => {
    const lowPlan = basePlan({ walkingLimit: "low" });
    const highPlan = basePlan({ walkingLimit: "high" });
    const easy = landmark({
      name: "Easy Park",
      ageTags: ["child"],
      intensity: "low",
    });
    const hard = landmark({
      name: "Hard Hike",
      ageTags: ["child"],
      intensity: "high",
    });
    expect(walkingFitScore(easy, lowPlan)).toBeGreaterThan(walkingFitScore(hard, lowPlan));
    expect(walkingFitScore(hard, lowPlan)).toBeLessThan(0);
    expect(walkingFitScore(hard, highPlan)).toBeGreaterThanOrEqual(0);
  });

  it("pickLandmarkForFamily avoids high-intensity when walking is limited", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const plan = basePlan({
      children: [6],
      walkingLimit: "low",
      transportationType: "walking",
      budgetStyle: "save",
    });
    const pick = pickLandmarkForFamily(sanDiego, plan, 1, 0, [], {
      preferBand: "child",
    });
    expect(pick.intensity).not.toBe("high");
  });
});

describe("FAM-7 — enrich title ↔ location match", () => {
  it("extractLandmarkFromTitle pulls the landmark name from planned titles", () => {
    expect(extractLandmarkFromTitle("Explore Balboa Park")).toBe("Balboa Park");
    expect(extractLandmarkFromTitle("Family time at San Diego Zoo")).toBe("San Diego Zoo");
    expect(extractLandmarkFromTitle("Visit USS Midway Museum")).toBe("USS Midway Museum");
  });

  it("findLandmarkByName resolves extracted titles to catalog entries", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const name = extractLandmarkFromTitle("Explore Balboa Park");
    expect(name).toBeTruthy();
    const matched = findLandmarkByName(sanDiego.landmarks, name!);
    expect(matched?.name).toBe("Balboa Park");
    expect(matched?.lat).toBe(32.7341);
  });
});
