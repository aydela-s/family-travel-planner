/**
 * Writes compare-engines-out.json (score vs staged) for manual review.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import type { TripPlan } from "@/types/trip-plan";

function sdPlan(): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-07-28",
    endDate: "2026-08-01",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    stayAddress: "Carlton",
    stayLat: 32.7157,
    stayLng: -117.1611,
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [
      "Playgrounds & Indoor Play",
      "Interactive Museums",
      "Beaches & Waterfronts",
      "Shows & Entertainment",
    ],
  };
}

function summarize(engine: "score" | "staged") {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
  const { raw, blueprint, plannerEngine } = planTrip(sdPlan(), {
    cityOverride: city,
    plannerEngine: engine,
  });

  const days = raw.days.map((d) => {
    const bp = blueprint?.days.find((x) => x.dayIndex === d.day);
    return {
      day: d.day,
      date: bp?.date,
      role: bp?.role,
      themeId: bp?.theme.id,
      themeLabel: bp?.theme.label,
      dayBudgetIntent: bp?.dayBudgetIntent,
      goals: bp?.goals.map((g) => g.type) ?? [],
      constraints: bp?.constraints.map((c) => c.type) ?? [],
      anchor: bp?.anchor
        ? {
            name: bp.anchor.landmarkName,
            tags: bp.anchor.interestTags,
            isPaid: bp.anchor.isPaid,
          }
        : null,
      support:
        bp?.support.map((s) => ({
          name: s.landmarkName,
          tags: s.interestTags,
          isPaid: s.isPaid,
        })) ?? [],
      timeline: d.activities.map((a) => ({
        time: a.time,
        endTime: a.endTime,
        type: a.type,
        title: a.title,
      })),
    };
  });

  return {
    plannerEngine,
    experienceCoverage: blueprint?.experienceCoverage ?? null,
    days,
  };
}

describe("compare planner engines (artifact)", () => {
  it("writes score vs staged JSON for review", () => {
    const score = summarize("score");
    const staged = summarize("staged");
    const out = {
      plan: {
        destination: "San Diego",
        dates: "2026-07-28 – 2026-08-01",
        interests: [
          "Playgrounds & Indoor Play",
          "Interactive Museums",
          "Beaches & Waterfronts",
          "Shows & Entertainment",
        ],
        ages: [4, 8],
        budget: "balanced",
        pace: "balanced",
        naps: "12:30–2:00 regular",
        dietary: "vegan",
      },
      score,
      staged,
      sideBySide: score.days.map((s, i) => {
        const t = staged.days[i]!;
        return {
          day: s.day,
          scoreActivities: s.timeline
            .filter((x) => x.type === "activity")
            .map((x) => x.title),
          stagedTheme: t.themeId,
          stagedAnchor: t.anchor?.name ?? null,
          stagedSupport: t.support.map((x) => x.name),
          stagedActivities: t.timeline
            .filter((x) => x.type === "activity")
            .map((x) => x.title),
        };
      }),
    };
    writeFileSync("compare-engines-out.json", JSON.stringify(out, null, 2), "utf8");
    expect(staged.plannerEngine).toBe("staged");
    expect(score.plannerEngine).toBe("score");
  });
});
