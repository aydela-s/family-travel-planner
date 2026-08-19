import { describe, expect, it } from "vitest";
import { getDatesValidationError } from "@/lib/planning-engine/date-validation";
import { hasResolvedDestinationCenter } from "@/lib/city-detect";
import { findFirstIncompleteWizardStep } from "@/lib/plan-wizard/step-gate";
import { DALLAS_ITINERARY, DALLAS_PLAN } from "./dallas";

describe("Design Lab Dallas fixture", () => {
  it("is a complete wizard plan with future dates", () => {
    expect(hasResolvedDestinationCenter(DALLAS_PLAN)).toBe(true);
    expect(getDatesValidationError(DALLAS_PLAN)).toBeNull();
    expect(findFirstIncompleteWizardStep(DALLAS_PLAN)).toBeNull();
  });

  it("keeps four comparable days with matching cost totals", () => {
    expect(DALLAS_ITINERARY.days).toHaveLength(4);
    for (const day of DALLAS_ITINERARY.days) {
      const fromItems = day.activities.reduce((sum, activity) => sum + (activity.activityCost ?? 0), 0);
      expect(day.costBreakdown.total).toBe(day.costBreakdown.food + day.costBreakdown.transport + day.costBreakdown.activities);
      expect(day.costs.total).toBe(day.costBreakdown.total);
      expect(fromItems).toBe(day.costBreakdown.total);
    }
  });
});
