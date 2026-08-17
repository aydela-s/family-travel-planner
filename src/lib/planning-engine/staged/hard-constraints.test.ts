import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import { compileTripConstraints } from "@/lib/planning-engine/constraints";
import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import type { TripPlan } from "@/types/trip-plan";

function sdPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-17",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    stayAddress: "Carlton",
    stayLat: 32.7157,
    stayLng: -117.1611,
    dietaryRestrictions: "",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Parks & Gardens", "Beaches & Waterfronts"],
    ...overrides,
  };
}

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

describe("hard constraints through planTrip", () => {
  it("keeps no-naps behavior unchanged once the rule is compiled", () => {
    const trip = sdPlan({ naps: [] });
    expect(shouldIncludeNaps(trip)).toBe(false);
    expect(compileTripConstraints(trip).hard).toContainEqual({ kind: "no_naps" });

    const { raw } = planTrip(trip, { cityOverride: city, plannerEngine: "staged" });
    const types = raw.days.flatMap((d) => d.activities.map((a) => a.type));
    expect(types).not.toContain("nap");
    expect(raw.days.flatMap((d) => d.activities.map((a) => a.title)).join(" ")).not.toMatch(
      /\bnap\b/i,
    );
  });

  it("never schedules an excluded interest", () => {
    const trip = sdPlan({
      interests: ["Parks & Gardens", "Theme Parks"],
      userConstraints: { excludeInterests: ["Theme Parks"] },
    });
    const { raw, blueprint } = planTrip(trip, { cityOverride: city, plannerEngine: "staged" });
    const tags = [
      ...(blueprint?.days.flatMap((d) => [
        ...(d.anchor?.interestTags ?? []),
        ...d.support.flatMap((s) => s.interestTags),
      ]) ?? []),
      ...raw.days.flatMap((d) => d.activities.flatMap((a) => a.interestTags ?? [])),
    ];
    expect(tags).not.toContain("theme-parks");
  });
});
