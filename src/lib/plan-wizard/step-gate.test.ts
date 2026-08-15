import { describe, expect, it } from "vitest";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";
import { applyMinimalPlanDefaults } from "./planning-involvement";
import {
  findAdjacentWizardStep,
  findFirstIncompleteWizardStep,
  isWizardStepApplicable,
  isWizardStepComplete,
  visibleWizardStepCount,
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
    planningInvolvementMode: "detailed",
    accommodationType: "hotel_breakfast_included",
    stayAddress: "Hotel Del Coronado",
    transportationType: "walking",
    travelStyle: "balanced",
    walkingLimit: "medium",
    naps: [{ startTime: "12:00 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: ["Beaches"],
    ...overrides,
  };
}

describe("wizard step gate", () => {
  it("requires a Places-resolved destination center before leaving Destination", () => {
    const typedOnly = filledThroughInterests({
      destination: "Boise",
      destinationPlaceId: "",
      destinationLat: null,
      destinationLng: null,
    });
    expect(isWizardStepComplete(typedOnly, "Destination")).toBe(false);
    expect(findFirstIncompleteWizardStep(typedOnly)).toBe(0);
  });

  it("keeps Getting Around incomplete until transportation is chosen", () => {
    const plan = filledThroughInterests({ transportationType: "" });
    expect(isWizardStepComplete(plan, "Getting Around")).toBe(false);
    expect(findFirstIncompleteWizardStep(plan)).toBe(
      WIZARD_STEP_TITLES.indexOf("Getting Around"),
    );
  });

  it("does not treat Summary as reachable while Getting Around is empty", () => {
    const plan = filledThroughInterests({ transportationType: "" });
    const incomplete = findFirstIncompleteWizardStep(plan);
    expect(incomplete).not.toBeNull();
    expect(WIZARD_STEP_TITLES[incomplete!]).toBe("Getting Around");
    expect(WIZARD_STEP_TITLES[incomplete!]).not.toBe("Summary");
  });

  it("returns null when every step before Summary is complete", () => {
    expect(findFirstIncompleteWizardStep(filledThroughInterests())).toBeNull();
  });

  it("requires Planning Style before later preference steps", () => {
    const plan = filledThroughInterests({ planningInvolvementMode: "" });
    expect(isWizardStepComplete(plan, "Planning Style")).toBe(false);
    expect(findFirstIncompleteWizardStep(plan)).toBe(
      WIZARD_STEP_TITLES.indexOf("Planning Style"),
    );
  });
});

describe("planning involvement mode (FAM-73)", () => {
  it("skips preference steps in minimal mode and keeps naps for young kids", () => {
    const plan = applyMinimalPlanDefaults(
      filledThroughInterests({
        planningInvolvementMode: "",
        accommodationType: "",
        transportationType: "",
        travelStyle: "",
        budgetStyle: "",
        interests: [],
      }),
    );
    expect(plan.planningInvolvementMode).toBe("minimal");
    expect(isWizardStepApplicable(plan, "Stay")).toBe(false);
    expect(isWizardStepApplicable(plan, "Getting Around")).toBe(false);
    expect(isWizardStepApplicable(plan, "Travel Style")).toBe(false);
    expect(isWizardStepApplicable(plan, "Budget")).toBe(false);
    expect(isWizardStepApplicable(plan, "Interests")).toBe(false);
    expect(isWizardStepApplicable(plan, "Naps & Food")).toBe(true);
    expect(findFirstIncompleteWizardStep(plan)).toBeNull();
  });

  it("skips Naps & Food in minimal mode when naps are not shown", () => {
    const plan = applyMinimalPlanDefaults(
      filledThroughInterests({
        children: [12],
        naps: [],
        planningInvolvementMode: "",
        accommodationType: "",
        transportationType: "",
        travelStyle: "",
        budgetStyle: "",
        interests: [],
      }),
    );
    expect(isWizardStepApplicable(plan, "Naps & Food")).toBe(false);
    expect(findFirstIncompleteWizardStep(plan)).toBeNull();
  });

  it("jumps from Planning Style to Naps (or Summary) in minimal mode", () => {
    const plan = applyMinimalPlanDefaults(
      filledThroughInterests({
        children: [3],
        planningInvolvementMode: "",
        accommodationType: "",
        transportationType: "",
        travelStyle: "",
        budgetStyle: "",
        interests: [],
      }),
    );
    const planningIdx = WIZARD_STEP_TITLES.indexOf("Planning Style");
    const next = findAdjacentWizardStep(planningIdx, "forward", plan);
    expect(WIZARD_STEP_TITLES[next]).toBe("Naps & Food");

    const noNapPlan = applyMinimalPlanDefaults(
      filledThroughInterests({
        children: [14],
        naps: [],
        planningInvolvementMode: "",
        accommodationType: "",
        transportationType: "",
        travelStyle: "",
        budgetStyle: "",
        interests: [],
      }),
    );
    const nextAdult = findAdjacentWizardStep(planningIdx, "forward", noNapPlan);
    expect(WIZARD_STEP_TITLES[nextAdult]).toBe("Summary");
  });

  it("uses fewer visible steps in minimal mode", () => {
    const detailed = filledThroughInterests();
    const minimal = applyMinimalPlanDefaults(
      filledThroughInterests({
        planningInvolvementMode: "",
        accommodationType: "",
        transportationType: "",
        travelStyle: "",
        budgetStyle: "",
        interests: [],
      }),
    );
    expect(visibleWizardStepCount(minimal)).toBeLessThan(visibleWizardStepCount(detailed));
  });
});
