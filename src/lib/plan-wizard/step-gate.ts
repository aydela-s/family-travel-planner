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
  "Planning Style",
  "Stay",
  "Getting Around",
  "Travel Style",
  "Naps & Food",
  "Budget",
  "Interests",
  "Summary",
] as const;

/** Stable analytics IDs — same order as `WIZARD_STEP_TITLES`. */
export const WIZARD_STEP_IDS = [
  "destination",
  "dates",
  "travelers",
  "planning_style",
  "stay",
  "getting_around",
  "travel_style",
  "naps_food",
  "budget",
  "interests",
  "summary",
] as const;

export type WizardStepTitle = (typeof WIZARD_STEP_TITLES)[number];
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

export function isMinimalPlanningMode(plan: TripPlan): boolean {
  return plan.planningInvolvementMode === "minimal";
}

/**
 * Steps shown for the current involvement mode (FAM-73).
 * Unset mode behaves like detailed so older plans keep working.
 */
export function isWizardStepApplicable(plan: TripPlan, title: WizardStepTitle): boolean {
  if (title === "Summary" || title === "Destination" || title === "Dates" || title === "Travelers") {
    return true;
  }
  if (title === "Planning Style") return true;

  if (!isMinimalPlanningMode(plan)) return true;

  // Minimal: skip preference knobs; keep naps when young kids need them.
  switch (title) {
    case "Stay":
    case "Getting Around":
    case "Travel Style":
    case "Budget":
    case "Interests":
      return false;
    case "Naps & Food":
      return shouldShowNapSection(plan);
    default:
      return true;
  }
}

/**
 * Whether a step has everything required to leave it.
 * Summary is never "incomplete" on its own — gaps are earlier steps.
 * Non-applicable steps are treated as complete.
 */
export function isWizardStepComplete(plan: TripPlan, title: WizardStepTitle): boolean {
  if (!isWizardStepApplicable(plan, title)) return true;

  switch (title) {
    case "Destination":
      return hasResolvedDestinationCenter(plan);
    case "Dates":
      return getDatesValidationError(plan) === null;
    case "Travelers":
      return plan.adults >= 1 && plan.children.every((age) => age >= 0 && age <= 17);
    case "Planning Style":
      return plan.planningInvolvementMode === "minimal" || plan.planningInvolvementMode === "detailed";
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
    const title = WIZARD_STEP_TITLES[i]!;
    if (!isWizardStepApplicable(plan, title)) continue;
    if (!isWizardStepComplete(plan, title)) return i;
  }
  return null;
}

/** Next/previous applicable wizard index (skips hidden steps in minimal mode). */
export function findAdjacentWizardStep(
  fromIndex: number,
  direction: "forward" | "back",
  plan: TripPlan,
): number {
  const delta = direction === "forward" ? 1 : -1;
  let i = fromIndex + delta;
  while (i >= 0 && i < WIZARD_STEP_TITLES.length) {
    if (isWizardStepApplicable(plan, WIZARD_STEP_TITLES[i]!)) return i;
    i += delta;
  }
  return fromIndex;
}

/** Visible step count for progress UI. */
export function visibleWizardStepCount(plan: TripPlan): number {
  return WIZARD_STEP_TITLES.filter((title) => isWizardStepApplicable(plan, title)).length;
}

/** 1-based position among visible steps (for progress label). */
export function visibleWizardStepPosition(plan: TripPlan, stepIndex: number): number {
  let pos = 0;
  for (let i = 0; i <= stepIndex && i < WIZARD_STEP_TITLES.length; i++) {
    if (isWizardStepApplicable(plan, WIZARD_STEP_TITLES[i]!)) pos += 1;
  }
  return Math.max(1, pos);
}
