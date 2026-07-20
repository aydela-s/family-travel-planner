"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import BackToTopButton from "@/components/BackToTopButton";
import ItineraryDisplay from "@/components/ItineraryDisplay";
import LoadingScreen from "@/components/LoadingScreen";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";
import { Itinerary } from "@/types/itinerary";
import { GenerateItineraryOptions } from "@/types/generate";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";
import { getDatesValidationError } from "@/lib/planning-engine/date-validation";
import { isValidNapSelection } from "@/lib/planning-engine/nap-options";
import { resolveStayFromText } from "@/lib/planning-engine/resolve-stay";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import StepTransition from "./StepTransition";
import ActivityInterestsStep from "./steps/ActivityInterestsStep";
import BudgetStyleStep from "./steps/BudgetStyleStep";
import DatesStep from "./steps/DatesStep";
import DestinationStep from "./steps/DestinationStep";
import FoodPreferencesStep from "./steps/FoodPreferencesStep";
import NapScheduleStep from "./steps/NapScheduleStep";
import SummaryStep from "./steps/SummaryStep";
import TransportationStep from "./steps/TransportationStep";
import TravelersStep from "./steps/TravelersStep";
import TravelStyleStep from "./steps/TravelStyleStep";

const TOTAL_STEPS = 10;

const steps = [
  {
    title: "Destination",
    component: DestinationStep,
    validate: (plan: TripPlan) => plan.destination.trim() !== "",
  },
  {
    title: "Dates",
    component: DatesStep,
    validate: (plan: TripPlan) => getDatesValidationError(plan) === null,
  },
  {
    title: "Travelers",
    component: TravelersStep,
    validate: (plan: TripPlan) =>
      plan.adults >= 1 && plan.children.every((age) => age >= 0 && age <= 17),
  },
  {
    title: "Stay",
    component: FoodPreferencesStep,
    validate: (plan: TripPlan) =>
      plan.accommodationType !== "" &&
      (isStayNotBookedYet(plan) || (plan.stayAddress ?? "").trim().length >= 2),
  },
  {
    title: "Getting Around",
    component: TransportationStep,
    validate: (plan: TripPlan) => plan.transportationType !== "",
  },
  {
    title: "Travel Style",
    component: TravelStyleStep,
    validate: (plan: TripPlan) => plan.travelStyle !== "",
  },
  {
    title: "Naps & Food",
    component: NapScheduleStep,
    validate: () => true,
  },
  {
    title: "Budget",
    component: BudgetStyleStep,
    validate: (plan: TripPlan) => plan.budgetStyle !== "",
  },
  {
    title: "Interests",
    component: ActivityInterestsStep,
    validate: (plan: TripPlan) => plan.interests.length > 0,
  },
  {
    title: "Summary",
    component: SummaryStep,
    validate: () => true,
  },
] as const;

type GenerateParams = GenerateItineraryOptions & {
  planOverride?: Partial<TripPlan>;
  loadingMessage?: string;
};

export default function TripPlanWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward");
  const [formData, setFormData] = useState<TripPlan>(initialTripPlan);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [useDemoNext, setUseDemoNext] = useState(false);

  const currentStep = steps[stepIndex];
  const StepComponent = currentStep.component;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === TOTAL_STEPS - 1;
  const progress = ((stepIndex + 1) / TOTAL_STEPS) * 100;

  function updateFormData(updates: Partial<TripPlan>) {
    setFormData((current) => ({ ...current, ...updates }));
    setError("");
  }

  function goBack() {
    if (!isFirstStep) {
      setStepDirection("back");
      setStepIndex((index) => index - 1);
      setError("");
    }
  }

  function getStepError(plan: TripPlan): string | null {
    const step = steps[stepIndex];
    if (step.title === "Dates") return getDatesValidationError(plan);
    if (step.title === "Stay") {
      if (plan.accommodationType === "") {
        return "Choose how you’re staying so we can plan meals and groceries.";
      }
      if (!isStayNotBookedYet(plan) && (plan.stayAddress ?? "").trim().length < 2) {
        return "Type your hotel name or stay address, or choose “I don’t know yet”.";
      }
    }
    if (step.title === "Naps & Food" && plan.children.length > 0 && !isValidNapSelection(plan.napSchedule, true)) {
      return "Please choose a nap preference for your trip.";
    }
    if (!step.validate(plan)) return "Almost there — just fill in what's missing and we'll keep going.";
    return null;
  }

  async function goNext() {
    const stepError = getStepError(formData);
    if (stepError) {
      setError(stepError);
      return;
    }

    if (steps[stepIndex].title === "Stay") {
      setError("");
      const resolved = await resolveStayFromText(formData);
      if (resolved) {
        setFormData({ ...formData, ...resolved });
      }
    }

    if (!isLastStep) {
      setStepDirection("forward");
      setStepIndex((index) => index + 1);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function callGenerateApi(params: GenerateParams = {}) {
    let plan = { ...formData, ...params.planOverride };
    const demo = params.demo ?? useDemoNext;

    setIsLoading(true);
    setLoadingMessage(params.loadingMessage);
    setError("");

    try {
      const resolved = await resolveStayFromText(plan);
      if (resolved) {
        plan = { ...plan, ...resolved };
        setFormData((current) => ({ ...current, ...resolved }));
      }

      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plan,
          demo,
          relaxed: params.relaxed,
          adjustDay: params.adjustDay,
          adjustAction: params.adjustAction,
          adjustNote: params.adjustNote,
          existingItinerary: params.adjustDay ? itinerary : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate itinerary.");
      }

      const { demo: _demo, ...itineraryData } = data as Itinerary & { demo?: boolean };
      setItinerary(itineraryData as Itinerary);
      setIsDemo(demo || Boolean(data.demo));

      if (params.relaxed || params.adjustAction) {
        setFormData((current) => ({
          ...current,
          ...(params.relaxed ? { travelStyle: "relaxed", walkingLimit: "low" } : {}),
          ...(params.adjustAction === "less_walking" ? { walkingLimit: "low" } : {}),
          ...(params.adjustAction === "more_walking"
            ? { walkingLimit: "high", transportationType: "walking" }
            : {}),
        }));
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Something went wrong.";
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingMessage(undefined);
      setUseDemoNext(false);
    }
  }

  function handleGenerate(demo = false) {
    const stepError = getStepError(formData);
    if (stepError) {
      setError(stepError);
      return;
    }
    setUseDemoNext(demo);
    callGenerateApi({ demo });
  }

  function resetWizard() {
    setItinerary(null);
    setIsDemo(false);
    setStepIndex(0);
    setStepDirection("forward");
    setFormData(initialTripPlan);
    setError("");
  }

  function handleStepKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || isLoading) return;
    const target = e.target as HTMLElement;
    // Let textareas take literal newlines, and let a focused button handle its own Enter activation.
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    e.preventDefault();
    if (isLastStep) {
      handleGenerate(false);
    } else {
      goNext();
    }
  }

  if (isLoading && !itinerary) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2.5 text-[#1F5F5A] transition hover:opacity-80"
          >
            <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
            <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>
          <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-sky-100/50 backdrop-blur sm:p-10">
            <LoadingScreen message={loadingMessage} />
          </div>
        </div>
      </main>
    );
  }

  if (itinerary) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[#1F5F5A] transition hover:opacity-80"
          >
            <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
            <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>

          <div className="relative mt-6 rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-sky-100/50 backdrop-blur sm:p-10">
            <ItineraryDisplay
              itinerary={itinerary}
              isDemo={isDemo}
              isLoading={isLoading}
              onPlanAnother={resetWizard}
            />
          </div>
        </div>
        <BackToTopButton />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-[#1F5F5A] transition hover:opacity-80"
        >
          <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>

        <div
          className="mt-6 rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-sky-100/50 backdrop-blur sm:p-10"
          onKeyDown={handleStepKeyDown}
        >
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span className="font-medium">
                {stepIndex + 1} of {TOTAL_STEPS}
              </span>
              <span className="font-semibold text-sky-700">{currentStep.title}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {stepIndex === 0 && (
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Let&apos;s plan something your whole family will love.
              </p>
            )}
          </div>

          <StepTransition stepKey={stepIndex} direction={stepDirection}>
            <StepComponent formData={formData} updateFormData={updateFormData} />
          </StepTransition>

          {error && (
            <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm leading-relaxed text-red-700">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                disabled={isLoading}
                className="order-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:order-1 sm:flex-1"
              >
                Back
              </button>
            )}

            {isLastStep ? (
              <div className="order-1 flex w-full flex-col gap-3 sm:order-2 sm:flex-1">
                <button
                  type="button"
                  onClick={() => handleGenerate(false)}
                  disabled={isLoading}
                  className="w-full rounded-full bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-700 hover:shadow-xl disabled:opacity-50"
                >
                  Generate itinerary
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={isLoading}
                  className="w-full rounded-full border border-amber-200 bg-amber-50 px-6 py-3.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  Try demo (free, no API key)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="order-1 w-full rounded-full bg-sky-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-700 sm:flex-1"
              >
                Sounds good →
              </button>
            )}
          </div>
        </div>
      </div>
      <BackToTopButton />
    </main>
  );
}
