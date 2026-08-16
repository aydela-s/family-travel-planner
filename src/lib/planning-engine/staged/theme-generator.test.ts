import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { buildTripStrategy } from "@/lib/planning-engine/staged/strategy-builder";
import {
  applyDailyThemes,
  eligibleInterestThemes,
  scoreTheme,
} from "@/lib/planning-engine/staged/theme-generator";
import { themeById } from "@/lib/planning-engine/staged/theme-catalog";
import { TripPlan } from "@/types/trip-plan";

function sdPlan(overrides: Partial<TripPlan> = {}): TripPlan {
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
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [
      "Playgrounds & Indoor Play",
      "Interactive Museums",
      "Beaches & Waterfronts",
      "Shows & Entertainment",
    ],
    ...overrides,
  };
}

describe("eligibleInterestThemes", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("maps zoos interest to animals and includes beach/play/interactive/entertainment", () => {
    const themes = eligibleInterestThemes(
      sdPlan({ interests: ["Zoos & Aquariums", "Beaches & Waterfronts"] }),
      city,
    ).map((t) => t.id);
    expect(themes).toContain("animals");
    expect(themes).toContain("beach");
    expect(themes).not.toContain("arrival");
  });

  it("does not open nature_parks theme for Nature & Scenic Views alone", () => {
    const themes = eligibleInterestThemes(
      sdPlan({
        interests: [
          "Swimming & Water Play",
          "Nature & Scenic Views",
          "Playgrounds & Indoor Play",
          "Theme Parks",
          "Interactive Museums",
          "Shopping",
        ],
      }),
      city,
    ).map((t) => t.id);
    expect(themes).toContain("nature");
    expect(themes).toContain("scenic");
    expect(themes).not.toContain("nature_parks");
  });
});

describe("scoreTheme weights", () => {
  it("penalizes repeating the same primary theme on adjacent days", () => {
    const plan = sdPlan();
    const beach = themeById("beach");
    const coverage = {
      items: [{ key: "beaches", tag: "beaches" as const, target: 2, completed: 0, source: "interest" as const }],
    };
    const fresh = scoreTheme(beach, {
      plan,
      coverage,
      reserved: new Map(),
      dayBudgetIntent: "free",
      previousThemeId: null,
    });
    const repeat = scoreTheme(beach, {
      plan,
      coverage,
      reserved: new Map(),
      dayBudgetIntent: "free",
      previousThemeId: "beach",
    });
    expect(repeat.varietyBonus).toBe(0);
    expect(repeat.total).toBeLessThan(fresh.total);
  });
});

describe("applyDailyThemes — San Diego 5-day shadow", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("assigns arrival / experience days / departure with internal theme ids", () => {
    const plan = sdPlan();
    const bp = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const ids = bp.days.map((d) => d.theme.id);

    expect(ids[0]).toBe("arrival");
    expect(ids[4]).toBe("departure");
    expect(bp.days[0]!.goals.some((g) => g.type === "low_friction")).toBe(true);
    expect(bp.days[4]!.goals.some((g) => g.type === "easy_exit")).toBe(true);

    const middle = ids.slice(1, 4);
    // Approved SD shape: experience days among animals/interactive, beach, play, entertainment.
    for (const id of middle) {
      expect([
        "interactive",
        "animals",
        "beach",
        "play_indoor",
        "playgrounds",
        "entertainment",
        "mixed_family",
        "scenic",
        "recovery",
      ]).toContain(id);
    }
    expect(middle).toContain("beach");
    expect(middle.some((id) => id === "interactive" || id === "animals")).toBe(true);
    expect(
      middle.some(
        (id) =>
          id === "entertainment" ||
          id === "mixed_family" ||
          id === "play_indoor" ||
          id === "playgrounds",
      ),
    ).toBe(true);
    // At least one dedicated play coverage theme when Playgrounds & Indoor Play is selected
    expect(middle.some((id) => id === "play_indoor" || id === "playgrounds")).toBe(true);
    // Indoor play is a separate coverage bucket from outdoor playgrounds
    expect(eligibleInterestThemes(plan, city).map((t) => t.id)).toContain("play_indoor");
    expect(eligibleInterestThemes(plan, city).map((t) => t.id)).toContain("playgrounds");

    // No adjacent duplicate primary themes
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).not.toBe(ids[i - 1]);
    }

    // Beach day discourages indoor paid as primary anchor
    const beachDay = bp.days.find((d) => d.theme.id === "beach");
    if (beachDay) {
      expect(beachDay.goals.some((g) => g.type === "dedicated_experience")).toBe(true);
      expect(
        beachDay.constraints.some((c) => c.type === "discourage_indoor_paid_anchor"),
      ).toBe(true);
      expect(beachDay.constraints.some((c) => c.type === "anchor_primary_tags")).toBe(true);
    }
  });

  it("keeps theme ids internal (not narrative display titles)", () => {
    const plan = sdPlan();
    const bp = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    for (const day of bp.days) {
      expect(day.theme.label).not.toMatch(/Ocean Adventure|Discover San Diego/i);
      expect(day.theme.id).not.toMatch(/\s/);
    }
  });

  it("mixed-age mixed_family days require older-appeal goal", () => {
    const plan = sdPlan({
      children: [3, 14],
      interests: ["Playgrounds & Indoor Play", "Beaches & Waterfronts"],
      startDate: "2026-09-15",
      endDate: "2026-09-17",
    });
    const bp = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const mixed = bp.days.find((d) => d.theme.id === "mixed_family");
    if (mixed) {
      expect(mixed.goals.some((g) => g.type === "include_older_appeal")).toBe(true);
    }
  });
});
