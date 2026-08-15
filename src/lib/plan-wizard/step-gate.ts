import { getDatesValidationError } from "@/lib/planning-engine/date-validation";
import { isValidNapSelection, shouldShowNapSection } from "@/lib/planning-engine/nap-options";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { hasResolvedDestinationCenter } from "@/lib/city-detect";
import { TripPlan } from "@/types/trip-plan";

/** Wizard step titles in order — keep in sync with TripPlanWizard `steps`. */
export const WIZARD_STEP_TITLES = [
  "Destination",
  "Dates",
  "Travelers",
  "Stay",
  "Getting Around",
  "Travel Style",
  "Naps & Food",
  "Budget",
  "Interests",
  "Summary",
] as const;

export type WizardStepTitle = (typeof WIZARD_STEP_TITLES)[number];

/**
 * Whether a step has everything required to leave it.
 * Summary is never "incomplete" on its own — gaps are earlier steps.
 */
export function isWizardStepComplete(plan: TripPlan, title: WizardStepTitle): boolean {
  switch (title) {
    case "Destination":
      return hasResolvedDestinationCenter(plan);
    case "Dates":
      return getDatesValidationError(plan) === null;
    case "Travelers":
      return plan.adults >= 1 && plan.children.every((age) => age >= 0 && age <= 17);
    case "Stay":
      return (
        plan.accommodationType !== "" &&
        (isStayNotBookedYet(plan) || (plan.stayAddress ?? "").trim().length >= 2)
      );
    case "Getting Around":
      return plan.transportationType !== "";
    case "Travel Style":
      return plan.travelStyle !== "";
    case "Naps & Food":
      return !shouldShowNapSection(plan) || isValidNapSelection(plan.naps, plan);
    case "Budget":
      return plan.budgetStyle !== "";
    case "Interests":
      return plan.interests.length > 0;
    case "Summary":
      return true;
  }
}

/** First incomplete required step index, or null if all prior-to-Summary steps are done. */
export function findFirstIncompleteWizardStep(plan: TripPlan): number | null {
  for (let i = 0; i < WIZARD_STEP_TITLES.length - 1; i++) {
    if (!isWizardStepComplete(plan, WIZARD_STEP_TITLES[i])) return i;
  }
  return null;
}
