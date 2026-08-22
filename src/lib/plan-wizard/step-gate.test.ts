import { describe, expect, it } from "vitest";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";
import {
  findFirstIncompleteWizardStep,
  isWizardStepComplete,
  wizardUnlockedThroughIndex,
  WIZARD_STEP_TITLES,
} from "./step-gate";

function filledThroughInterests(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    ...initialTripPlan,
    destination: "San Diego, CA",
    destinationPlaceId: "places/san-diego",
    destinationLat: 32.7157,
    destinationLng: -117.1611,
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    adults: 2,
    children: [3],
    accommodationType: "hotel_breakfast_included",
    stayAddress: "Hotel Del Coronado",
    transportationType: "walking",
    travelStyle: "balanced",
    walkingLimit: "medium",
    naps: [{ startTime: "12:00 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Swimming & Water Play"],
    ...overrides,
  };
}

describe("wizard step gate", () => {
  it("requires a Places-resolved destination before leaving Where & when", () => {
    const typedOnly = filledThroughInterests({
      destination: "Boise",
      destinationPlaceId: "",
      destinationLat: null,
      destinationLng: null,
    });
    expect(isWizardStepComplete(typedOnly, "Where & when")).toBe(false);
    expect(findFirstIncompleteWizardStep(typedOnly)).toBe(0);
  });

  it("keeps Stay & getting around incomplete until transportation is chosen", () => {
    const plan = filledThroughInterests({ transportationType: "" });
    expect(isWizardStepComplete(plan, "Stay & getting around")).toBe(false);
    expect(findFirstIncompleteWizardStep(plan)).toBe(
      WIZARD_STEP_TITLES.indexOf("Stay & getting around"),
    );
  });

  it("keeps Stay & getting around incomplete until hotel/rental detail is chosen", () => {
    const plan = filledThroughInterests({ accommodationType: "" });
    expect(isWizardStepComplete(plan, "Stay & getting around")).toBe(false);
  });

  it("requires both pace and spend on Pace & spend", () => {
    expect(
      isWizardStepComplete(filledThroughInterests({ budgetStyle: "" }), "Pace & spend"),
    ).toBe(false);
    expect(
      isWizardStepComplete(filledThroughInterests({ travelStyle: "" }), "Pace & spend"),
    ).toBe(false);
  });

  it("returns null when every step including Interests is complete", () => {
    expect(findFirstIncompleteWizardStep(filledThroughInterests())).toBeNull();
  });

  it("keeps completed later steps unlocked after going back, until earlier data is cleared", () => {
    const ready = filledThroughInterests();
    expect(wizardUnlockedThroughIndex(ready)).toBe(WIZARD_STEP_TITLES.length - 1);

    const missingInterests = filledThroughInterests({ interests: [] });
    expect(wizardUnlockedThroughIndex(missingInterests)).toBe(
      WIZARD_STEP_TITLES.indexOf("Interests"),
    );

    const stayCleared = filledThroughInterests({
      accommodationType: "",
      stayAddress: "",
      transportationType: "",
    });
    expect(wizardUnlockedThroughIndex(stayCleared)).toBe(
      WIZARD_STEP_TITLES.indexOf("Stay & getting around"),
    );
  });

  it("exposes five consolidated steps and no Summary", () => {
    expect(WIZARD_STEP_TITLES).toHaveLength(5);
    expect(WIZARD_STEP_TITLES).not.toContain("Summary");
    expect(WIZARD_STEP_TITLES).not.toContain("Food & naps");
  });

  it("requires a nap answer on Travelers when young kids are present", () => {
    const plan = filledThroughInterests({ naps: null });
    expect(isWizardStepComplete(plan, "Travelers")).toBe(false);
    expect(isWizardStepComplete(filledThroughInterests({ naps: [] }), "Travelers")).toBe(true);
  });
});
