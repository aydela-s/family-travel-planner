"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import ActivityInterestsStep from "@/components/plan-wizard/steps/ActivityInterestsStep";
import PaceBudgetStep from "@/components/plan-wizard/steps/PaceBudgetStep";
import StayTransitStep from "@/components/plan-wizard/steps/StayTransitStep";
import TravelersStep from "@/components/plan-wizard/steps/TravelersStep";
import WhereWhenStep from "@/components/plan-wizard/steps/WhereWhenStep";
import {
  btnCtaClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
} from "@/components/plan-wizard/shared";
import { WIZARD_STEP_TITLES, wizardUnlockedThroughIndex } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import { conceptPath } from "../concepts";
import { useHarborSkin } from "../harbor-skin";
import { useDesignLab } from "../state";

const STEPS = [
  WhereWhenStep,
  TravelersStep,
  StayTransitStep,
  PaceBudgetStep,
  ActivityInterestsStep,
] as const;

function StepCheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path
        d="M5 10.5 8.5 14 15 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Soft fill + check: completed stays quiet; only the current step gets dark-teal fill. */
function SoftCheckStepIndicator({
  index,
  active,
  completed,
  locked,
}: {
  index: number;
  active: boolean;
  completed: boolean;
  locked: boolean;
}) {
  if (active) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-white">
        {index + 1}
      </span>
    );
  }
  if (completed) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary">
        <StepCheckIcon />
      </span>
    );
  }
  if (locked) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-xs font-medium tabular-nums text-muted/50">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium tabular-nums text-muted">
      {index + 1}
    </span>
  );
}

export function HarborWizard() {
  const { plan, updatePlan, stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const signals = useHarborSkin() === "signals";
  const Step = STEPS[stepIndex] ?? WhereWhenStep;
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;
  const unlockedThroughIndex = wizardUnlockedThroughIndex(plan);

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <Link href={conceptPath("harbor")} className="inline-flex text-ink transition hover:opacity-80">
          <FamilyTravelyLogo className="h-auto w-48" />
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav>
            <ol className="space-y-1">
              {WIZARD_STEP_TITLES.map((title, index) => {
                const active = index === stepIndex;
                const locked = index > unlockedThroughIndex;
                const completed = !active && !locked && index < unlockedThroughIndex;
                return (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => {
                        if (locked || active) return;
                        goStep(index);
                      }}
                      disabled={locked}
                      aria-current={active ? "step" : undefined}
                      className={`flex w-full items-center gap-2 rounded-full px-2 py-2 text-left text-sm ${
                        active
                          ? "font-semibold text-primary"
                          : locked
                            ? "cursor-not-allowed font-medium text-muted/50"
                            : signals
                              ? "font-medium text-muted hover:bg-secondary-muted hover:text-ink"
                              : "font-medium text-muted hover:bg-secondary-muted hover:text-primary"
                      }`}
                    >
                      <SoftCheckStepIndicator
                        index={index}
                        active={active}
                        completed={completed}
                        locked={locked}
                      />
                      <span className={active && !signals ? "border-b-2 border-accent pb-0.5" : ""}>{title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
            <Step formData={plan} updateFormData={updatePlan} />

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
                <Link
                  href={canGenerate ? conceptPath("harbor", "itinerary") : "#"}
                  aria-disabled={!canGenerate}
                  className={`order-1 w-full text-center sm:order-2 sm:flex-1 ${btnCtaClassName} ${
                    canGenerate ? "" : "pointer-events-none opacity-50"
                  }`}
                >
                  Generate itinerary
                </Link>
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
          </div>
        </div>
      </div>
    </div>
  );
}
