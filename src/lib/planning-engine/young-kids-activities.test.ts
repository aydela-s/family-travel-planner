import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import { extractLandmarkFromTitle } from "@/lib/schedule/landmark-hours";
import { landmarkInterestScore, pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

function youngKidsPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego, CA",
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    adults: 1,
    children: [3, 5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "Vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Nature & Scenic Views", "Playgrounds & Indoor Play"],
    ...overrides,
  };
}

function activityPlaceNames(titles: string[]): string[] {
  return titles
    .map((t) => extractLandmarkFromTitle(t))
    .filter((n): n is string => Boolean(n));
}

describe("young kids — real activities over stroll fillers", () => {
  it("skips evening stroll slots when young kids have a nap", () => {
    const kinds = buildDaySkeleton(youngKidsPlan(), 1, 4).map((s) => s.kind);
    expect(kinds).toContain("afternoon_activity");
    expect(kinds).not.toContain("evening_rest");
  });

  it("does not repeat Explore/Visit landmarks across days while alternatives remain", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const { raw } = planTrip(youngKidsPlan(), { plannerEngine: "score" });
    const activityNames = raw.days.flatMap((d) =>
      d.activities
        .filter((a) => a.type === "activity")
        .map((a) => extractLandmarkFromTitle(a.title))
        .filter((n): n is string => Boolean(n)),
    );
    // 4 days × 2 activities = 8; SD catalog has more than enough unique stops.
    expect(activityNames.length).toBeGreaterThanOrEqual(6);
    expect(new Set(activityNames).size).toBe(activityNames.length);
    expect(activityNames.length).toBeLessThanOrEqual(city.landmarks.length);
  });

  it("prefers playground and indoor-play stops when Playgrounds & Indoor Play is selected", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const plan = youngKidsPlan({ budgetStyle: "balanced" });
    const playground = city.landmarks.find((l) => l.name === "Mission Bay Park")!;
    const bounceHouse = city.landmarks.find((l) =>
      l.name.startsWith("Funbox"),
    )!;
    const scenicOnly = city.landmarks.find((l) => l.name === "Torrey Pines State Natural Reserve")!;
    expect(landmarkInterestScore(playground, plan)).toBeGreaterThan(
      landmarkInterestScore(scenicOnly, plan),
    );
    expect(landmarkInterestScore(bounceHouse, plan)).toBeGreaterThan(
      landmarkInterestScore(scenicOnly, plan),
    );

    const morning = pickLandmarkForFamily(city, plan, 1, 0, [], {
      preferBand: "toddler",
    });
    const afternoon = pickLandmarkForFamily(city, plan, 1, 1, [morning], {
      preferBand: "child",
      visitWindow: { startMin: 14 * 60 + 15, endMin: 15 * 60 + 45, visitDate: plan.startDate },
    });
    const picks = [morning, afternoon];
    expect(
      picks.some(
        (p) =>
          p.interestTags.includes("playgrounds") || p.interestTags.includes("indoor-play"),
      ),
    ).toBe(true);
  });

  it("schedules outdoor playground or indoor bounce/soft-play stops across a multi-day trip", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const kidPlayNames = new Set(
      city.landmarks
        .filter(
          (l) =>
            l.interestTags.includes("playgrounds") || l.interestTags.includes("indoor-play"),
        )
        .map((l) => l.name),
    );
    const indoorPlayNames = new Set(
      city.landmarks.filter((l) => l.interestTags.includes("indoor-play")).map((l) => l.name),
    );
    expect(indoorPlayNames.size).toBeGreaterThanOrEqual(2);

    const { raw } = planTrip(youngKidsPlan(), { plannerEngine: "score" });
    const activityNames = raw.days.flatMap((d) =>
      activityPlaceNames(d.activities.filter((a) => a.type === "activity").map((a) => a.title)),
    );
    const kidPlayHits = activityNames.filter((n) => kidPlayNames.has(n));
    expect(kidPlayHits.length).toBeGreaterThanOrEqual(2);
    // At least one indoor bounce/soft-play venue should appear when that catalog exists.
    expect(activityNames.some((n) => indoorPlayNames.has(n))).toBe(true);
    const titles = raw.days.flatMap((d) => d.activities.map((a) => a.title));
    expect(titles.some((t) => /stroll near/i.test(t))).toBe(false);
  });
});
