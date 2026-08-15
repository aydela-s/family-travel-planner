import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  buildExperienceCoverageTargets,
  maxTargetForInterestTag,
  targetForInterest,
} from "@/lib/planning-engine/staged/experience-coverage";
import { buildTripStrategy } from "@/lib/planning-engine/staged/strategy-builder";
import {
  applyDailyThemes,
  eligibleInterestThemes,
} from "@/lib/planning-engine/staged/theme-generator";
import type { TripPlan } from "@/types/trip-plan";

function dallasPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Dallas, TX",
    startDate: "2026-08-17",
    endDate: "2026-08-20",
    adults: 1,
    children: [3, 6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "rental_with_kitchen",
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Museums & Art", "Shopping", "Shows & Entertainment", "Sports & Recreation"],
    ...overrides,
  };
}

describe("shopping coverage caps", () => {
  it("caps shopping target to 1 on multi-interest short trips", () => {
    expect(targetForInterest(4, 4)).toBe(1);
    expect(maxTargetForInterestTag("shopping", 4, 4)).toBe(1);
    expect(maxTargetForInterestTag("museums", 4, 4)).toBeNull();

    const coverage = buildExperienceCoverageTargets(dallasPlan(), 4);
    const shopping = coverage.items.find((i) => i.tag === "shopping");
    const museums = coverage.items.find((i) => i.tag === "museums");
    expect(shopping?.target).toBe(1);
    expect(museums?.target).toBe(1);
  });
});

describe("shopping theme diversity", () => {
  it("exposes shopping theme when the city has shopping landmarks", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const withShopping = {
      ...city,
      landmarks: [
        {
          ...city.landmarks[0]!,
          name: "Fashion Valley Mall",
          interestTags: ["shopping" as const],
        },
        ...city.landmarks.slice(1),
      ],
    };
    const themes = eligibleInterestThemes(
      dallasPlan({
        destination: "San Diego",
        interests: ["Museums & Art", "Shopping"],
      }),
      withShopping,
    ).map((t) => t.id);
    expect(themes).toContain("shopping");
    expect(themes).toContain("museums");
  });

  it("assigns at most one Shopping Day on a 4-day multi-interest trip", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const withShopping = {
      ...city,
      landmarks: city.landmarks.map((l, i) =>
        i === 0
          ? {
              ...l,
              interestTags: [...new Set([...l.interestTags, "shopping" as const])],
              name: "Fashion Valley Mall",
            }
          : i === 1
            ? {
                ...l,
                interestTags: [...new Set([...l.interestTags, "museums" as const])],
              }
            : l,
      ),
    };
    const plan = dallasPlan({
      destination: "San Diego",
      interests: ["Museums & Art", "Shopping", "Beaches & Waterfronts"],
    });
    const bp = applyDailyThemes(
      buildTripStrategy(plan, { city: withShopping }),
      plan,
      withShopping,
    );
    const shoppingDays = bp.days.filter((d) => d.theme.id === "shopping");
    expect(shoppingDays.length).toBeLessThanOrEqual(1);
    const themeIds = bp.days.filter((d) => d.role === "full").map((d) => d.theme.id);
    expect(
      themeIds.some((id) => id === "museums" || id === "beach" || id === "mixed_family"),
    ).toBe(true);
  });
});
