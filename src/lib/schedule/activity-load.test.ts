import { describe, expect, it } from "vitest";
import type { Landmark } from "@/config/city-pricing";
import {
  activityLoadAgeBand,
  activityLoadUnits,
  dailyLoadBudget,
  fitsInDailyLoadBudget,
  sumActivityLoadUnits,
  typicalDurationMinForLandmark,
  visitDurationForTags,
} from "@/lib/schedule/activity-load";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Boise",
    startDate: "2026-09-01",
    endDate: "2026-09-04",
    adults: 2,
    children: [4, 6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Zoos & Aquariums", "Playgrounds & Indoor Play"],
    ...overrides,
  };
}

function lm(
  partial: Partial<Landmark> & Pick<Landmark, "name" | "interestTags" | "intensity">,
): Landmark {
  return {
    lat: 1,
    lng: 2,
    adultPrice: 20,
    openingHours: { open: "09:00", close: "17:00" },
    ageTags: ["child"],
    indoor: false,
    ...partial,
  };
}

describe("activity load age band (FAM-76)", () => {
  it("uses youngest child for mixed-age families", () => {
    expect(activityLoadAgeBand(plan({ children: [3, 14] }))).toBe("young");
    expect(activityLoadAgeBand(plan({ children: [9, 14] }))).toBe("school");
    expect(activityLoadAgeBand(plan({ children: [15] }))).toBe("adult");
    expect(activityLoadAgeBand(plan({ children: [] }))).toBe("adult");
  });

  it("same travel style yields different load budgets by family age", () => {
    const young = dailyLoadBudget(plan({ children: [3, 5], travelStyle: "balanced" }));
    const older = dailyLoadBudget(plan({ children: [10, 12], travelStyle: "balanced" }));
    const adults = dailyLoadBudget(plan({ children: [], travelStyle: "balanced" }));
    expect(older).toBeGreaterThan(young);
    expect(adults).toBeGreaterThan(older);
  });

  it("relaxed < balanced < packed load budgets for the same family", () => {
    const kids = { children: [4, 6] as number[] };
    expect(dailyLoadBudget(plan({ ...kids, travelStyle: "relaxed" }))).toBeLessThan(
      dailyLoadBudget(plan({ ...kids, travelStyle: "balanced" })),
    );
    expect(dailyLoadBudget(plan({ ...kids, travelStyle: "balanced" }))).toBeLessThan(
      dailyLoadBudget(plan({ ...kids, travelStyle: "packed" })),
    );
  });

  it("maps style × age to slot caps without collapsing balanced+nap to one stop", () => {
    const youngBalancedNap = getIntensityConfig(
      plan({
        children: [3, 6],
        travelStyle: "balanced",
        naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
      }),
    );
    expect(youngBalancedNap.maxActivities).toBe(2);
    expect(getIntensityConfig(plan({ children: [3], travelStyle: "relaxed" })).maxActivities).toBe(
      1,
    );
    expect(getIntensityConfig(plan({ children: [3], travelStyle: "packed" })).maxActivities).toBe(
      3,
    );
  });
});

describe("activity load units (FAM-77)", () => {
  const playground = lm({
    name: "Neighborhood Playground",
    interestTags: ["playgrounds"],
    intensity: "low",
  });
  const zoo = lm({
    name: "City Zoo",
    interestTags: ["zoos"],
    intensity: "high",
  });

  it("charges long/high-intensity stops more than short/light ones", () => {
    expect(typicalDurationMinForLandmark(zoo)).toBeGreaterThan(
      typicalDurationMinForLandmark(playground),
    );
    expect(activityLoadUnits(zoo)).toBeGreaterThan(activityLoadUnits(playground));
  });

  it("lets several short stops approach one long stop's load", () => {
    const oneZoo = activityLoadUnits(zoo);
    const threePlay = sumActivityLoadUnits([playground, playground, playground]);
    expect(threePlay).toBeGreaterThan(oneZoo * 0.75);
    expect(threePlay).toBeLessThan(oneZoo * 2.2);
  });

  it("accounts for travel time before a stop", () => {
    const base = activityLoadUnits(playground);
    const withTravel = activityLoadUnits(playground, { travelMinBefore: 40 });
    expect(withTravel).toBeGreaterThan(base);
  });

  it("blocks a heavy second stop when the day budget is already spent", () => {
    const youngPackedBudget = plan({
      children: [3, 5],
      travelStyle: "balanced",
      naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    });
    // Zoo as first stop — should not fit another zoo on a young balanced+nap day.
    expect(fitsInDailyLoadBudget([zoo], zoo, youngPackedBudget)).toBe(false);
    // Light park companion can still fit after a short museum window.
    const museum = lm({
      name: "Science Museum",
      interestTags: ["museums"],
      intensity: "low",
    });
    const park = lm({
      name: "City Park",
      interestTags: ["parks"],
      intensity: "low",
    });
    expect(fitsInDailyLoadBudget([museum], park, youngPackedBudget)).toBe(true);
  });

  it("always allows the first stop of the day", () => {
    expect(fitsInDailyLoadBudget([], zoo, plan({ travelStyle: "relaxed", children: [2] }))).toBe(
      true,
    );
  });
});

describe("visit duration by category and kid age", () => {
  it("schedules indoor play for 1.5–2 hours, not a 45-minute stop", () => {
    expect(visitDurationForTags(["indoor-play"], { youngest: 4 })).toBe(90);
    expect(visitDurationForTags(["indoor-play"], { youngest: 10 })).toBe(105);
    expect(visitDurationForTags(["indoor-play"], { youngest: 15 })).toBe(120);
  });

  it("gives water play 2–3 hours and shopping 1.5–3 hours by age", () => {
    expect(visitDurationForTags(["beaches"], { youngest: 4, title: "Heights Aquatic Center" })).toBe(
      120,
    );
    expect(visitDurationForTags(["beaches"], { youngest: 10 })).toBe(150);
    expect(visitDurationForTags(["beaches"], { youngest: null })).toBe(180);
    expect(visitDurationForTags(["shopping"], { youngest: 5 })).toBe(90);
    expect(visitDurationForTags(["shopping"], { youngest: 16 })).toBe(180);
  });
});
