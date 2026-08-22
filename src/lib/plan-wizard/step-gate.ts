import { getDatesValidationError } from "@/lib/planning-engine/date-validation";
import { isValidNapSelection } from "@/lib/planning-engine/nap-options";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { hasResolvedDestinationCenter } from "@/lib/city-detect";
import { TripPlan } from "@/types/trip-plan";

/** Wizard step titles in order — keep in sync with TripPlanWizard `STEP_LOADERS`. */
export const WIZARD_STEP_TITLES = [
  "Where & when",
  "Travelers",
  "Stay & getting around",
  "Pace & spend",
  "Interests",
] as const;

/** Stable analytics IDs — same order as `WIZARD_STEP_TITLES`. */
export const WIZARD_STEP_IDS = [
  "where_when",
  "travelers",
  "stay_transit",
  "pace_budget",
  "interests",
] as const;

export type WizardStepTitle = (typeof WIZARD_STEP_TITLES)[number];
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

/**
 * Whether a step has everything required to leave it (or to generate from Interests).
 */
export function isWizardStepComplete(plan: TripPlan, title: WizardStepTitle): boolean {
  switch (title) {
    case "Where & when":
      return hasResolvedDestinationCenter(plan) && getDatesValidationError(plan) === null;
    case "Travelers":
      return (
        plan.adults >= 1 &&
        plan.children.every((age) => age >= 0 && age <= 17) &&
        isValidNapSelection(plan.naps, plan)
      );
    case "Stay & getting around":
      return (
        plan.accommodationType !== "" &&
        (isStayNotBookedYet(plan) || (plan.stayAddress ?? "").trim().length >= 2) &&
        plan.transportationType !== ""
      );
    case "Pace & spend":
      return plan.travelStyle !== "" && plan.budgetStyle !== "";
    case "Interests":
      return plan.interests.length > 0;
  }
}

/** First incomplete required step index, or null if the plan is ready to generate. */
export function findFirstIncompleteWizardStep(plan: TripPlan): number | null {
  for (let i = 0; i < WIZARD_STEP_TITLES.length; i++) {
    if (!isWizardStepComplete(plan, WIZARD_STEP_TITLES[i]!)) return i;
  }
  return null;
}

/**
 * Furthest step the left nav may open. Completed steps stay reachable after
 * going back; later steps lock again if earlier required data is cleared.
 */
export function wizardUnlockedThroughIndex(plan: TripPlan): number {
  const firstIncomplete = findFirstIncompleteWizardStep(plan);
  return firstIncomplete === null ? WIZARD_STEP_TITLES.length - 1 : firstIncomplete;
}
