"use client";

import ItineraryDisplay from "@/components/ItineraryDisplay";
import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { BRAND } from "@/config/brand";
import { WIZARD_STEP_TITLES, wizardUnlockedThroughIndex } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import type { ReactNode } from "react";
import ActivityInterestsStep from "@/components/plan-wizard/steps/ActivityInterestsStep";
import PaceBudgetStep from "@/components/plan-wizard/steps/PaceBudgetStep";
import StayTransitStep from "@/components/plan-wizard/steps/StayTransitStep";
import TravelersStep from "@/components/plan-wizard/steps/TravelersStep";
import WhereWhenStep from "@/components/plan-wizard/steps/WhereWhenStep";
import { WizardShell } from "@/components/plan-wizard/WizardShell";
import {
  btnCtaClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
} from "@/components/plan-wizard/shared";
import { useDesignLab } from "./state";
import type { LabScreen } from "./concepts";

const STEPS = [
  WhereWhenStep,
  TravelersStep,
  StayTransitStep,
  PaceBudgetStep,
  ActivityInterestsStep,
] as const;

export function CurrentHomePane({ children, onStartPlan }: { children: ReactNode; onStartPlan: () => void }) {
  return (
    <div
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (anchor?.getAttribute("href") === "/plan") {
          event.preventDefault();
          event.stopPropagation();
          onStartPlan();
        }
      }}
    >
      {children}
    </div>
  );
}

export function CurrentWizardPane({ onShowItinerary }: { onShowItinerary: () => void }) {
  const { plan, updatePlan, stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const Step = STEPS[stepIndex] ?? WhereWhenStep;
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

  return (
    <WizardShell
      stepIndex={stepIndex}
      totalSteps={WIZARD_STEP_TITLES.length}
      stepTitle={WIZARD_STEP_TITLES[stepIndex]}
      unlockedThroughIndex={wizardUnlockedThroughIndex(plan)}
      onSelectStep={goStep}
      footer={
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => goStep(stepIndex - 1)}
            disabled={stepIndex === 0}
            tabIndex={stepIndex === 0 ? -1 : undefined}
            aria-hidden={stepIndex === 0}
            className={`order-2 sm:order-1 sm:flex-1 ${btnSecondaryClassName} ${
              stepIndex === 0 ? "invisible pointer-events-none" : ""
            }`}
          >
            Back
          </button>
          {last ? (
            <button
              type="button"
              disabled={!canGenerate}
              onClick={onShowItinerary}
              className={`order-1 w-full sm:order-2 sm:flex-1 ${btnCtaClassName}`}
            >
              Generate itinerary
            </button>
          ) : (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => goStep(stepIndex + 1)}
              className={`order-1 w-full sm:order-2 sm:flex-1 ${btnPrimaryClassName}`}
            >
              Sounds good →
            </button>
          )}
        </div>
      }
    >
      <Step formData={plan} updateFormData={updatePlan} />
    </WizardShell>
  );
}

export function CurrentItineraryPane({ onEditInWizard }: { onEditInWizard: (stepIndex: number) => void }) {
  const { itinerary, plan, updatePlan, goStep } = useDesignLab();
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2.5 text-primary transition hover:opacity-80">
          <FamilyTravelyLogo variant="mark" className="h-10 w-auto shrink-0" />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        <div className="mt-8">
          <ItineraryDisplay
            itinerary={itinerary}
            plan={plan}
            onApplyPlanUpdate={updatePlan}
            onEditPlanInWizard={(stepIndex, updates) => {
              if (updates) updatePlan(updates);
              goStep(stepIndex);
              onEditInWizard(stepIndex);
            }}
          />
        </div>
      </div>
    </main>
  );
}

export function CurrentProductScreen({
  screen,
  currentHome,
  onStartPlan,
  onShowItinerary,
}: {
  screen: LabScreen;
  currentHome: ReactNode;
  onStartPlan: () => void;
  onShowItinerary: () => void;
}) {
  if (screen === "home") {
    return <CurrentHomePane onStartPlan={onStartPlan}>{currentHome}</CurrentHomePane>;
  }
  if (screen === "wizard") {
    return <CurrentWizardPane onShowItinerary={onShowItinerary} />;
  }
  return <CurrentItineraryPane onEditInWizard={() => onStartPlan()} />;
}
