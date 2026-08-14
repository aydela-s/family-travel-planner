import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { onSiteCafeLabel } from "@/lib/planning-engine/meal-planner";
import { buildLandmarkContext, fillDaySkeleton } from "@/lib/planning-engine/slot-filler";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import { TripPlan } from "@/types/trip-plan";

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego, CA",
    startDate: "2026-09-16",
    endDate: "2026-09-16",
    adults: 2,
    children: [5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Interactive Museums"],
    ...overrides,
  };
}

describe("on-site café meals", () => {
  it("formats an on-site café meal title", () => {
    expect(onSiteCafeLabel("lunch", "Fleet Science Center").title).toBe(
      "Lunch at Fleet Science Center café",
    );
  });

  it("schedules lunch at a venue café when morning stop supports on-site lunch", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;
    // Save lunch is not a named-restaurant meal, so on-site café preference can win.
    const plan = basePlan({
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      budgetStyle: "save",
    });
    const ctx = buildLandmarkContext(city, plan, 1, 1);
    // Force morning to Fleet (open Wednesday) to assert café preference.
    const forced = { ...ctx, morning: fleet };
    const slots = buildDaySkeleton(plan, 1, 1);
    const activities = fillDaySkeleton(slots, plan, city, forced, 1, 1);
    const lunch = activities.find((a) => a.slotKind === "lunch" || /lunch/i.test(a.title));
    expect(lunch?.title).toBe("Lunch at Fleet Science Center café");
  });

  it("does not use on-site café when dietary restrictions need named restaurants", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;
    const plan = basePlan({
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dietaryRestrictions: "Gluten-free",
      budgetStyle: "splurge",
    });
    const ctx = { ...buildLandmarkContext(city, plan, 1, 1), morning: fleet };
    const slots = buildDaySkeleton(plan, 1, 1);
    const activities = fillDaySkeleton(slots, plan, city, ctx, 1, 1);
    const lunch = activities.find((a) => a.slotKind === "lunch" || /lunch/i.test(a.title));
    expect(lunch?.title).not.toMatch(/café/i);
  });
});
