"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import ActivityInterestsStep from "@/components/plan-wizard/steps/ActivityInterestsStep";
import NapScheduleStep from "@/components/plan-wizard/steps/NapScheduleStep";
import PaceBudgetStep from "@/components/plan-wizard/steps/PaceBudgetStep";
import StayTransitStep from "@/components/plan-wizard/steps/StayTransitStep";
import WhereWhenStep from "@/components/plan-wizard/steps/WhereWhenStep";
import {
  btnCtaClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
  CounterControl,
  DynamicHint,
  getTravelerHints,
  inputClassName,
  labelClassName,
  StepIntro,
} from "@/components/plan-wizard/shared";
import { DEFAULT_NAP_ENTRY, shouldShowNapSection } from "@/lib/planning-engine/nap-options";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import type { StepProps } from "@/types/trip-plan";
import Link from "next/link";
import { conceptPath } from "../concepts";
import { useHarborSkin } from "../harbor-skin";
import { useDesignLab } from "../state";

const childAges = Array.from({ length: 18 }, (_, age) => age);

function defaultNapsOpen() {
  return [{ ...DEFAULT_NAP_ENTRY }];
}

function HarborTravelersStep({ formData, updateFormData }: StepProps) {
  function handleChildCountChange(count: number) {
    const children = [...formData.children];
    while (children.length < count) children.push(0);
    while (children.length > count) children.pop();
    const wasShown = shouldShowNapSection(formData);
    const willShow = shouldShowNapSection({ children });
    updateFormData({
      children,
      ...(!willShow ? { naps: [] } : !wasShown ? { naps: defaultNapsOpen() } : {}),
    });
  }

  function handleChildAgeChange(index: number, age: number) {
    const children = [...formData.children];
    children[index] = age;
    const wasShown = shouldShowNapSection(formData);
    const willShow = shouldShowNapSection({ children });
    updateFormData({
      children,
      ...(!willShow ? { naps: [] } : !wasShown ? { naps: defaultNapsOpen() } : {}),
    });
  }

  const hints = getTravelerHints(formData.children);

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="👨‍👩‍👧‍👦"
        title="Who's coming along?"
        subtitle="Tell us who's in your travel squad so we can plan for every age."
      />

      <div className="grid grid-cols-2 gap-4">
        <CounterControl
          label="Adults"
          value={formData.adults}
          min={1}
          max={12}
          onChange={(adults) => updateFormData({ adults })}
        />
        <CounterControl
          label="Kids"
          value={formData.children.length}
          min={0}
          max={10}
          onChange={handleChildCountChange}
        />
      </div>

      {formData.children.length > 0 ? (
        <div>
          <p className={labelClassName}>How old is each kiddo?</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {formData.children.map((age, index) => (
              <label key={index} className="block rounded-2xl border border-border bg-background p-4">
                <span className="text-sm font-semibold text-ink">Child {index + 1}</span>
                <select
                  className={inputClassName}
                  value={age}
                  onChange={(event) => handleChildAgeChange(index, Number(event.target.value))}
                >
                  {childAges.map((option) => (
                    <option key={option} value={option}>
                      {option === 0 ? "Under 1" : `${option} year${option === 1 ? "" : "s"}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {hints.map((hint) => (
        <DynamicHint key={hint}>{hint}</DynamicHint>
      ))}
    </div>
  );
}

const STEPS = [
  WhereWhenStep,
  HarborTravelersStep,
  StayTransitStep,
  PaceBudgetStep,
  NapScheduleStep,
  ActivityInterestsStep,
] as const;

export function HarborWizard() {
  const { plan, updatePlan, stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const signals = useHarborSkin() === "signals";
  const Step = STEPS[stepIndex] ?? WhereWhenStep;
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

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
                return (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => goStep(index)}
                      className={`flex w-full items-center gap-2 rounded-full px-2 py-2 text-left text-sm ${
                        active
                          ? "font-semibold text-primary"
                          : signals
                            ? "font-medium text-muted hover:bg-secondary-muted hover:text-ink"
                            : "font-medium text-muted hover:bg-secondary-muted hover:text-primary"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${
                          active
                            ? "bg-primary text-white"
                            : signals
                              ? "border border-border text-muted"
                              : "border border-primary/25 text-primary"
                        }`}
                      >
                        {index + 1}
                      </span>
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
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => goStep(stepIndex - 1)}
                  className={`order-2 sm:order-1 sm:flex-1 ${btnSecondaryClassName}`}
                >
                  Back
                </button>
              ) : null}
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
                  className={`order-1 w-full sm:flex-1 ${btnPrimaryClassName}`}
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
