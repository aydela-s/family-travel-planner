import { describe, expect, it } from "vitest";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";
import {
  findFirstIncompleteWizardStep,
  isWizardStepComplete,
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
});
