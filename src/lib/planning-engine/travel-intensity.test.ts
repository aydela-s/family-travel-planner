import { describe, expect, it } from "vitest";
import { buildDayIntents } from "@/lib/planning-engine/skeleton-builder";
import { TravelStyle, TripPlan } from "@/types/trip-plan";

/**
 * Regression coverage for FAM-5 ("Balanced and packed options produce the
 * same result") and the general intensity ordering it exposed: activity
 * count must strictly increase as travel style gets busier, for every
 * family composition — not just for families without young kids.
 */

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// Fixed everything except travelStyle/children so the only variable between
// runs is the thing under test.
const BASE_PLAN: Omit<TripPlan, "travelStyle" | "children"> = {
  destination: "Paris",
  startDate: isoDateOffset(30),
  endDate: isoDateOffset(34),
  adults: 2,
  walkingLimit: "medium",
  transportationType: "public-transportation",
  // Avoids the airbnb-with-kitchen cook-at-home/grocery slot, which would
  // otherwise be a confounding variable for "activity" slot counts.
  accommodationType: "hotel_breakfast_included",
  dietaryRestrictions: "",
  napSchedule: "",
  budgetStyle: "balanced",
  interests: [],
};

type FamilyProfile = { name: string; children: number[] };

const FAMILY_PROFILES: FamilyProfile[] = [
  { name: "adults only", children: [] },
  { name: "toddler family (ages 2, 5)", children: [2, 5] },
  { name: "mixed ages (2, 9, 17)", children: [2, 9, 17] },
  { name: "older kids (10, 16)", children: [10, 16] },
];

const ACTIVITY_INTENT_KINDS = new Set([
  "morning_activity",
  "afternoon_activity",
  "extra_activity",
]);

/** Activity intents in the day skeleton — structure before optional drops at schedule time. */
function activityCount(children: number[], travelStyle: TravelStyle): number {
  const plan: TripPlan = { ...BASE_PLAN, children, travelStyle };
  const intents = buildDayIntents(plan, 1, 4);
  return intents.filter((i) => ACTIVITY_INTENT_KINDS.has(i.kind)).length;
}

describe("travel style intensity — activity slot counts (FAM-5)", () => {
  it.each(FAMILY_PROFILES)(
    "packed produces more activity slots than balanced — $name",
    ({ children }) => {
      const packed = activityCount(children, "packed");
      const balanced = activityCount(children, "balanced");
      expect(packed).toBeGreaterThan(balanced);
    },
  );

  it.each(FAMILY_PROFILES)(
    "balanced produces more activity slots than relaxed — $name",
    ({ children }) => {
      const balanced = activityCount(children, "balanced");
      const relaxed = activityCount(children, "relaxed");
      expect(balanced).toBeGreaterThan(relaxed);
    },
  );
});
