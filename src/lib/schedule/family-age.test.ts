import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, Landmark } from "@/config/city-pricing";
import {
  getFamilyAgeProfile,
  landmarkAgeScore,
  pickLandmarkForFamily,
  suggestActivityTitle,
} from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function planWithChildren(children: number[]): TripPlan {
  return {
    destination: "Paris",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children,
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "splurge",
    interests: [],
  };
}

function landmark(partial: Partial<Landmark> & Pick<Landmark, "name" | "ageTags">): Landmark {
  return {
    lat: 48.85,
    lng: 2.35,
    adultPrice: 0,
    openingHours: { open: "09:00", close: "18:00" },
    intensity: "medium",
    indoor: false,
    interestTags: [],
    ...partial,
  };
}

describe("family age bands — Phase 5", () => {
  it("treats age 4–7 as young child, not tween", () => {
    const profile = getFamilyAgeProfile(planWithChildren([7]));
    expect(profile.hasYoungChild).toBe(true);
    expect(profile.hasTween).toBe(false);
  });

  it("treats age 8 as tween (spec 8–12), not young child", () => {
    const profile = getFamilyAgeProfile(planWithChildren([8]));
    expect(profile.hasTween).toBe(true);
    expect(profile.hasYoungChild).toBe(false);
  });

  it("keeps toddler 0–3 and teen 13+", () => {
    expect(getFamilyAgeProfile(planWithChildren([3])).hasToddler).toBe(true);
    expect(getFamilyAgeProfile(planWithChildren([3])).hasYoungChild).toBe(false);
    expect(getFamilyAgeProfile(planWithChildren([13])).hasTeen).toBe(true);
    expect(getFamilyAgeProfile(planWithChildren([12])).hasTween).toBe(true);
    expect(getFamilyAgeProfile(planWithChildren([12])).hasTeen).toBe(false);
  });

  it("marks mixed ages when bands differ", () => {
    expect(getFamilyAgeProfile(planWithChildren([2, 10])).isMixedAges).toBe(true);
    expect(getFamilyAgeProfile(planWithChildren([5, 6])).isMixedAges).toBe(false);
  });
});

describe("ageTags scoring — Phase 5", () => {
  const toddlerSpot = landmark({ name: "Playground", ageTags: ["toddler", "child"] });
  const teenSpot = landmark({ name: "Teen Museum", ageTags: ["teen"] });
  const tweenBlend = landmark({ name: "Science Center", ageTags: ["child", "tween", "teen"] });
  const childOnly = landmark({ name: "Kids Zoo", ageTags: ["child"] });

  it("boosts toddler-tagged landmarks for toddler families", () => {
    const profile = getFamilyAgeProfile(planWithChildren([2]));
    expect(landmarkAgeScore(toddlerSpot, profile)).toBeGreaterThan(
      landmarkAgeScore(teenSpot, profile),
    );
  });

  it("boosts child-tagged landmarks for ages 4–7", () => {
    const profile = getFamilyAgeProfile(planWithChildren([5]));
    expect(landmarkAgeScore(childOnly, profile)).toBeGreaterThan(
      landmarkAgeScore(teenSpot, profile),
    );
  });

  it("blends child + teen tags for tweens (8–12)", () => {
    const profile = getFamilyAgeProfile(planWithChildren([10]));
    expect(landmarkAgeScore(tweenBlend, profile)).toBeGreaterThan(
      landmarkAgeScore(toddlerSpot, profile),
    );
    expect(landmarkAgeScore(tweenBlend, profile)).toBeGreaterThan(
      landmarkAgeScore(teenSpot, profile),
    );
  });

  it("boosts teen-tagged landmarks for teens", () => {
    const profile = getFamilyAgeProfile(planWithChildren([15]));
    expect(landmarkAgeScore(teenSpot, profile)).toBeGreaterThan(
      landmarkAgeScore(toddlerSpot, profile),
    );
  });

  it("prefers multi-tag landmarks for mixed-age families", () => {
    const profile = getFamilyAgeProfile(planWithChildren([3, 14]));
    expect(landmarkAgeScore(tweenBlend, profile)).toBeGreaterThan(
      landmarkAgeScore(teenSpot, profile),
    );
  });

  it("pickLandmarkForFamily prefers toddler-tagged stops for toddler-only trips", () => {
    const paris = CITY_CONFIGS.find((c) => c.id === "paris")!;
    const plan = { ...planWithChildren([2]), budgetStyle: "save" as const };
    // Free tier: Jardin (toddler/child) and Montmartre (child/tween/teen).
    const pick = pickLandmarkForFamily(paris, plan, 1, 0, []);
    expect(pick.ageTags).toContain("toddler");
    expect(pick.name).toBe("Jardin du Luxembourg");
  });
});

describe("suggestActivityTitle — FAM-18", () => {
  it("does not prefix Morning: or Afternoon:", () => {
    const plan = planWithChildren([10]);
    expect(suggestActivityTitle("Louvre Museum", plan, "morning")).toBe(
      "Explore Louvre Museum",
    );
    expect(suggestActivityTitle("Louvre Museum", plan, "afternoon")).toBe(
      "Explore Louvre Museum",
    );
    expect(suggestActivityTitle("Louvre Museum", plan, "morning")).not.toMatch(
      /^(Morning|Afternoon):/,
    );
  });
});
