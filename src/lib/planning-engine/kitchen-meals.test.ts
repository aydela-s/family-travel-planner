import { describe, expect, it } from "vitest";
import { planTrip } from "@/lib/planning-engine";
import {
  dinnerLabel,
  isKitchenSelfCatering,
  lunchLabel,
  shouldAddTripStartGrocery,
  shouldCookDinnerAtHome,
  shouldFoldLunchIntoDay1Grocery,
  shouldPlaceGroceryBeforeRegularNap,
} from "@/lib/planning-engine/meal-planner";
import {
  isGroceryActivity,
  isTripStartGroceryActivity,
} from "@/lib/schedule/meal-planning";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 2,
    children: [8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "airbnb_with_kitchen",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [],
    stayLat: 32.7157,
    stayLng: -117.1611,
    ...overrides,
  };
}

describe("FAM-74 — rental + kitchen meal logic", () => {
  it("identifies kitchen self-catering stays", () => {
    expect(isKitchenSelfCatering(plan())).toBe(true);
    expect(isKitchenSelfCatering(plan({ accommodationType: "hotel_no_breakfast" }))).toBe(false);
  });

  it("cooks dinner at the rental every night except splurge", () => {
    const kitchen = plan();
    expect(shouldCookDinnerAtHome(kitchen, 1)).toBe(true);
    expect(shouldCookDinnerAtHome(kitchen, 2)).toBe(true);
    expect(shouldCookDinnerAtHome(plan({ budgetStyle: "splurge" }), 1)).toBe(false);
  });

  // Titles stay short ("Lunch near X"); the packed-from-the-rental intent lives in the notes.
  it("keeps packed-from-the-rental lunch on save budget", () => {
    const { title, notes } = lunchLabel(plan({ budgetStyle: "save" }), "Balboa Park");
    expect(title).toBe("Lunch near Balboa Park");
    expect(notes.toLowerCase()).toMatch(/pack|rental/);
  });

  it("plans lunch out for balanced kitchen stays", () => {
    const { title, notes } = lunchLabel(plan(), "Balboa Park");
    expect(notes.toLowerCase()).not.toMatch(/pack lunch/);
    expect(`${title} ${notes}`.toLowerCase()).toMatch(/lunch/);
  });

  it("labels cook-at-home dinners for kitchen stays", () => {
    const { title, notes } = dinnerLabel(plan(), "Balboa Park", 2);
    expect(title).toMatch(/cook dinner at your rental/i);
    expect(notes.toLowerCase()).toMatch(/trip-start|grocer/);
  });

  it("generates cook-at-home dinners across the trip", () => {
    const { raw } = planTrip(plan(), { plannerEngine: "staged" });
    const dinners = raw.days.flatMap((d) =>
      d.activities.filter((a) => a.type === "meal" && /dinner/i.test(a.title)),
    );
    expect(dinners.every((d) => /cook dinner at your rental/i.test(d.title))).toBe(true);
  });
});

describe("FAM-75 — one trip-start grocery shop", () => {
  it("only schedules trip-start grocery on day 1", () => {
    expect(shouldAddTripStartGrocery(plan(), 1)).toBe(true);
    expect(shouldAddTripStartGrocery(plan(), 2)).toBe(false);
    expect(shouldAddTripStartGrocery(plan({ budgetStyle: "splurge" }), 1)).toBe(false);
  });

  it("adds exactly one grocery stop on a multi-day kitchen trip", () => {
    const { raw } = planTrip(plan(), { plannerEngine: "staged" });
    const groceries = raw.days.flatMap((d) => d.activities.filter(isGroceryActivity));
    expect(groceries).toHaveLength(1);
    expect(isTripStartGroceryActivity(groceries[0]!)).toBe(true);
    expect(raw.days[0]!.activities.some(isTripStartGroceryActivity)).toBe(true);
    expect(raw.days.slice(1).every((d) => !d.activities.some(isGroceryActivity))).toBe(true);
  });

  it("places day-1 grocery before dinner when there is no nap", () => {
    const { raw } = planTrip(plan({ children: [10], naps: [] }), { plannerEngine: "staged" });
    const day1 = raw.days[0]!.activities;
    const groceryIdx = day1.findIndex(isTripStartGroceryActivity);
    const dinnerIdx = day1.findIndex((a) => a.type === "meal" && /dinner/i.test(a.title));
    expect(groceryIdx).toBeGreaterThanOrEqual(0);
    expect(dinnerIdx).toBeGreaterThan(groceryIdx);
  });

  it("places day-1 grocery before regular nap", () => {
    expect(
      shouldPlaceGroceryBeforeRegularNap(
        plan({
          children: [3],
          naps: [{ startTime: "1:00 PM", endTime: "3:00 PM", type: "regular" }],
        }),
        1,
      ),
    ).toBe(true);

    const { raw } = planTrip(
      plan({
        children: [3],
        naps: [{ startTime: "1:00 PM", endTime: "3:00 PM", type: "regular" }],
      }),
      { plannerEngine: "staged" },
    );
    const day1 = raw.days[0]!.activities;
    const groceryIdx = day1.findIndex(isTripStartGroceryActivity);
    const napIdx = day1.findIndex((a) => a.type === "nap");
    expect(groceryIdx).toBeGreaterThanOrEqual(0);
    expect(napIdx).toBeGreaterThan(groceryIdx);
    expect(parseTimeToMinutes(day1[groceryIdx]!.time)).toBeLessThan(
      parseTimeToMinutes(day1[napIdx]!.time),
    );
  });

  it("places day-1 grocery before dinner for stroller-only naps", () => {
    const stroller = plan({
      children: [1],
      naps: [{ startTime: "1:00 PM", endTime: "3:00 PM", type: "stroller" }],
    });
    expect(shouldPlaceGroceryBeforeRegularNap(stroller, 1)).toBe(false);

    const { raw } = planTrip(stroller, { plannerEngine: "staged" });
    const day1 = raw.days[0]!.activities;
    expect(day1.some((a) => a.type === "nap")).toBe(false);
    const groceryIdx = day1.findIndex(isTripStartGroceryActivity);
    const dinnerIdx = day1.findIndex((a) => a.type === "meal" && /dinner/i.test(a.title));
    expect(groceryIdx).toBeGreaterThanOrEqual(0);
    expect(dinnerIdx).toBeGreaterThan(groceryIdx);
  });

  it("folds day-1 nap-overlap lunch into grocery instead of takeout before it", () => {
    const napLunch = plan({
      children: [3],
      naps: [{ startTime: "12:00 PM", endTime: "1:30 PM", type: "regular" }],
    });
    expect(shouldFoldLunchIntoDay1Grocery(napLunch, 1)).toBe(true);

    const { raw } = planTrip(napLunch, { plannerEngine: "staged" });
    const day1 = raw.days[0]!.activities;
    const takeout = day1.find((a) => /takeout or delivery lunch/i.test(a.title));
    expect(takeout).toBeUndefined();
    const grocery = day1.find(isTripStartGroceryActivity);
    expect(grocery).toBeDefined();
    expect(grocery!.notes?.toLowerCase()).toMatch(/grab lunch|order delivery/);
    expect(grocery!.notes?.toLowerCase()).not.toMatch(/arrive with nap/);
    const groceryIdx = day1.findIndex(isTripStartGroceryActivity);
    const napIdx = day1.findIndex((a) => a.type === "nap");
    expect(napIdx).toBeGreaterThan(groceryIdx);
  });

  it("does not add grocery for hotel stays", () => {
    const { raw } = planTrip(
      plan({ accommodationType: "hotel_no_breakfast" }),
      { plannerEngine: "staged" },
    );
    const groceries = raw.days.flatMap((d) => d.activities.filter(isGroceryActivity));
    expect(groceries).toHaveLength(0);
  });
});
