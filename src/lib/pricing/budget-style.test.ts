import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import { BudgetStyle, TripPlan } from "@/types/trip-plan";

/**
 * Regression coverage for the Budget Style migration: replacing the numeric
 * daily budget cap with save/balanced/splurge. These tests lock in that
 * style actually drives different (real) costs and copy — not a dollar
 * target the planner tries to hit.
 */

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const BASE_PLAN: Omit<TripPlan, "budgetStyle"> = {
  destination: "San Diego",
  startDate: isoDateOffset(40),
  endDate: isoDateOffset(43),
  adults: 2,
  children: [6, 10],
  travelStyle: "balanced",
  walkingLimit: "medium",
  transportationType: "public-transportation",
  accommodationType: "hotel_no_breakfast",
  dietaryRestrictions: "",
  napSchedule: "",
  interests: [],
};

function planFor(style: BudgetStyle): TripPlan {
  return { ...BASE_PLAN, budgetStyle: style };
}

async function tripTotalCost(style: BudgetStyle): Promise<number> {
  const plan = planFor(style);
  const { raw, plan: workingPlan } = planTrip(plan);
  const itinerary = await enrichItinerary(raw, workingPlan);
  return itinerary.days.reduce((sum, d) => sum + d.costs.total, 0);
}

describe("Budget Style drives real cost differences, not a numeric cap", () => {
  it("Save Money produces a cheaper trip than Splurge for the same family/destination", async () => {
    const saveTotal = await tripTotalCost("save");
    const splurgeTotal = await tripTotalCost("splurge");
    expect(saveTotal).toBeLessThan(splurgeTotal);
  });

  it("Balanced sits between Save Money and Splurge", async () => {
    const [saveTotal, balancedTotal, splurgeTotal] = await Promise.all([
      tripTotalCost("save"),
      tripTotalCost("balanced"),
      tripTotalCost("splurge"),
    ]);
    expect(balancedTotal).toBeGreaterThanOrEqual(saveTotal);
    expect(balancedTotal).toBeLessThanOrEqual(splurgeTotal);
  });

  it("cost breakdown is informational only — no dollar cap, no usage percentage", async () => {
    const plan = planFor("balanced");
    const { raw, plan: workingPlan } = planTrip(plan);
    const itinerary = await enrichItinerary(raw, workingPlan);
    const day = itinerary.days[0];

    expect(day.costBreakdown).not.toHaveProperty("budgetCap");
    expect(day.costBreakdown).not.toHaveProperty("onBudget");
    expect(day).not.toHaveProperty("budgetUsagePercentage");
    expect(day).not.toHaveProperty("costSavingTips");
    expect(typeof day.costBreakdown.note).toBe("string");
    expect(day.costBreakdown.note!.length).toBeGreaterThan(0);
  });

  it("meal copy never includes a dollar figure; splurge names restaurants, save stays casual", async () => {
    const savePlan = planFor("save");
    const splurgePlan = planFor("splurge");
    const saveRaw = planTrip(savePlan);
    const splurgeRaw = planTrip(splurgePlan);

    const saveResult = await enrichItinerary(saveRaw.raw, saveRaw.plan);
    const splurgeResult = await enrichItinerary(splurgeRaw.raw, splurgeRaw.plan);

    const saveMeals = saveResult.days[0].activities.filter((a) => a.type === "meal");
    const splurgeMeals = splurgeResult.days[0].activities.filter((a) => a.type === "meal");
    const saveDinner = saveMeals[saveMeals.length - 1];
    const splurgeDinner = splurgeMeals[splurgeMeals.length - 1];

    expect(saveDinner.title).toMatch(/Casual dinner/i);
    expect(splurgeDinner.title).toMatch(/Dinner at /);
    expect(saveDinner.title).not.toBe(splurgeDinner.title);
    expect(saveDinner.notes ?? "").not.toMatch(/\$\d/);
    expect(splurgeDinner.notes ?? "").not.toMatch(/\$\d/);
    expect(saveDinner.location?.name).toBeTruthy();
  });
});
