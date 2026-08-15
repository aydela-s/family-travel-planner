"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import BackToTopButton from "@/components/BackToTopButton";
import { useFeedbackVisibility } from "@/components/FeedbackVisibility";
import { shouldAllowFeedbackLauncher } from "@/lib/feedback-visibility";
import LoadingScreen from "@/components/LoadingScreen";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";
import { Itinerary } from "@/types/itinerary";
import { GenerateItineraryOptions } from "@/types/generate";
import { initialTripPlan, TripPlan, type StepProps } from "@/types/trip-plan";
import { getDatesValidationError } from "@/lib/planning-engine/date-validation";
import {
  findAdjacentWizardStep,
  findFirstIncompleteWizardStep,
  isWizardStepComplete,
  visibleWizardStepCount,
  visibleWizardStepPosition,
  WIZARD_STEP_IDS,
  WIZARD_STEP_TITLES,
  type WizardStepTitle,
} from "@/lib/plan-wizard/step-gate";
import {
  itineraryProductProps,
  trackItineraryGenerated,
  trackItineraryViewed,
  trackPlannerCompleted,
  trackPlannerStarted,
  trackPlannerStepViewed,
} from "@/lib/analytics";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import StepTransition from "./StepTransition";
import DestinationStep from "./steps/DestinationStep";
import { WizardShell } from "./WizardShell";
import {
  btnCtaClassName,
  btnGhostClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
} from "./shared";

/** Keep PDF/export off the first wizard paint. */
const ItineraryDisplay = dynamic(() => import("@/components/ItineraryDisplay"), {
  ssr: false,
  loading: () => <LoadingScreen message="Building your itinerary…" />,
});

type StepLoader = () => Promise<{ default: ComponentType<StepProps> }>;

const TOTAL_STEPS = 11;

/** Explicit loaders — Destination is eager; others load on demand into a cache. */
const STEP_LOADERS: Array<StepLoader | null> = [
  null,
  () => import("./steps/DatesStep"),
  () => import("./steps/TravelersStep"),
  () => import("./steps/PlanningInvolvementStep"),
  () => import("./steps/FoodPreferencesStep"),
  () => import("./steps/TransportationStep"),
  () => import("./steps/TravelStyleStep"),
  () => import("./steps/NapScheduleStep"),
  () => import("./steps/BudgetStyleStep"),
  () => import("./steps/ActivityInterestsStep"),
  () => import("./steps/SummaryStep"),
];

const stepComponentCache: Array<ComponentType<StepProps> | null> = [
  DestinationStep,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

const stepLoadPromises: Array<Promise<ComponentType<StepProps>> | null> = STEP_LOADERS.map(
  () => null,
);

/** Resolve a step component before navigating — never paint an empty lazy placeholder. */
function ensureStepComponent(index: number): Promise<ComponentType<StepProps>> {
  if (index < 0 || index >= TOTAL_STEPS) {
    return Promise.resolve(DestinationStep);
  }
  const cached = stepComponentCache[index];
  if (cached) return Promise.resolve(cached);

  const existing = stepLoadPromises[index];
  if (existing) return existing;

  const loader = STEP_LOADERS[index];
  if (!loader) {
    return Promise.resolve(DestinationStep);
  }

  const promise = loader().then((mod) => {
    stepComponentCache[index] = mod.default;
    return mod.default;
  });
  stepLoadPromises[index] = promise;
  return promise;
}

/** Prefetch upcoming step chunks (and nearby deps) while the user is still typing. */
function prefetchWizardAhead(fromIndex: number) {
  void ensureStepComponent(fromIndex + 1);
  void ensureStepComponent(fromIndex + 2);

  // Stay is index 4 after Planning Style was inserted.
  if (fromIndex >= 3 && fromIndex <= 4) {
    void import("@/lib/planning-engine/resolve-stay");
  }
  if (fromIndex >= TOTAL_STEPS - 2) {
    void import("@/components/ItineraryDisplay");
  }
}

type GenerateParams = GenerateItineraryOptions & {
  planOverride?: Partial<TripPlan>;
  loadingMessage?: string;
};

export default function TripPlanWizard() {
  const searchParams = useSearchParams();
  const shareId = searchParams.get("share");
  const { setAllowed: setFeedbackAllowed } = useFeedbackVisibility();
  const [stepIndex, setStepIndex] = useState(0);
  const [stepDirection, setStepDirection] = useState<"forward" | "back">("forward");
  const [formData, setFormData] = useState<TripPlan>(initialTripPlan);
  const [error, setError] = useState("");
  // When opening a shared trip, start on the loading screen — never flash an empty wizard.
  const [isLoading, setIsLoading] = useState(() => Boolean(shareId));
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(() =>
    shareId ? "Loading your itinerary…" : undefined,
  );
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [useDemoNext, setUseDemoNext] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  /** Places confirm / other in-step async work (destination pick, etc.). */
  const [isStepBusy, setIsStepBusy] = useState(false);
  /** Blocks double Continue / Enter while Stay geocode (or any advance) is in flight. */
  const advancingRef = useRef(false);
  const plannerStartedRef = useRef(false);
  const lastStepViewedRef = useRef<number | null>(null);
  const lastItineraryViewedKeyRef = useRef<string | null>(null);
  /** Always a real step component — never a blank dynamic() loading shell. */
  const [StepComponent, setStepComponent] =
    useState<ComponentType<StepProps>>(() => DestinationStep);

  const currentTitle = WIZARD_STEP_TITLES[stepIndex]!;
  const visibleTotal = visibleWizardStepCount(formData);
  const visiblePosition = visibleWizardStepPosition(formData, stepIndex);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === TOTAL_STEPS - 1;
  const continueBusy = isAdvancing || isStepBusy;

  function markPlannerStarted() {
    if (plannerStartedRef.current || shareId) return;
    plannerStartedRef.current = true;
    trackPlannerStarted();
  }

  async function goToStep(nextIndex: number, direction: "forward" | "back") {
    const component = await ensureStepComponent(nextIndex);
    setStepComponent(() => component);
    setStepDirection(direction);
    setStepIndex(nextIndex);
  }

  useEffect(() => {
    setIsStepBusy(false);
  }, [stepIndex]);

  // Funnel: one step-viewed per entry while the wizard (not itinerary) is showing.
  useEffect(() => {
    if (shareId || itinerary || isLoading) return;
    if (lastStepViewedRef.current === stepIndex) return;
    lastStepViewedRef.current = stepIndex;
    const stepId = WIZARD_STEP_IDS[stepIndex];
    if (!stepId) return;
    trackPlannerStepViewed(stepId, stepIndex);
  }, [stepIndex, itinerary, isLoading, shareId]);

  // Funnel: itinerary actually on screen (generated or opened via share link).
  useEffect(() => {
    if (!itinerary || isLoading) return;
    const fingerprint = itinerary.days
      .map((d) => `${d.day}:${d.activities.map((a) => a.title).join(",")}`)
      .join(";");
    const viewKey = `${shareId ?? "gen"}:${fingerprint}`;
    if (lastItineraryViewedKeyRef.current === viewKey) return;
    lastItineraryViewedKeyRef.current = viewKey;
    trackItineraryViewed(itineraryProductProps(formData));
    // formData is read once when a distinct itinerary first appears on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: dedupe by itinerary fingerprint only
  }, [itinerary, isLoading, shareId]);

  // While the user fills this step, warm the next one(s) so Continue feels instant.
  useEffect(() => {
    if (itinerary || isLoading) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchWizardAhead(stepIndex);
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run);
    } else {
      timeoutId = setTimeout(run, 1);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [stepIndex, itinerary, isLoading]);

  // Feedback launcher: only on the itinerary/planner view — never during wizard steps (FAM-79).
  useEffect(() => {
    setFeedbackAllowed(shouldAllowFeedbackLauncher(Boolean(itinerary)));
    return () => setFeedbackAllowed(false);
  }, [itinerary, setFeedbackAllowed]);

  // Never land on Summary (or past a required step) with gaps — send the user back.
  useEffect(() => {
    if (itinerary || isLoading) return;
    const incomplete = findFirstIncompleteWizardStep(formData);
    if (incomplete === null || incomplete >= stepIndex) return;
    void (async () => {
      await goToStep(incomplete, "back");
      setError("Almost there — just fill in what's missing and we'll keep going.");
    })();
  }, [formData, stepIndex, itinerary, isLoading]);

  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;
    (async () => {
      setLoadingMessage("Loading your itinerary…");
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/itinerary-shares/${shareId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Shared itinerary not found.");
        if (cancelled) return;
        if (data.plan) {
          setFormData({ ...initialTripPlan, ...(data.plan as TripPlan) });
        }
        setItinerary(data.itinerary as Itinerary);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn’t load this shared trip.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setLoadingMessage(undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  function updateFormData(updates: Partial<TripPlan>) {
    if (updates.destinationPlaceId) {
      markPlannerStarted();
    }
    setFormData((current) => ({ ...current, ...updates }));
    setError("");
  }

  async function goBack() {
    if (isFirstStep || advancingRef.current) return;
    advancingRef.current = true;
    setIsAdvancing(true);
    try {
      const prev = findAdjacentWizardStep(stepIndex, "back", formData);
      await goToStep(prev, "back");
      setError("");
    } finally {
      advancingRef.current = false;
      setIsAdvancing(false);
    }
  }

  function getStepError(
    plan: TripPlan,
    title: WizardStepTitle = WIZARD_STEP_TITLES[stepIndex]!,
  ): string | null {
    if (title === "Destination" && !isWizardStepComplete(plan, title)) {
      return "Pick a city from the suggestions so we can plan in the right place.";
    }
    if (title === "Dates") return getDatesValidationError(plan);
    if (title === "Stay") {
      if (plan.accommodationType === "") {
        return "Choose how you’re staying so we can plan meals and groceries.";
      }
      if (!isStayNotBookedYet(plan) && (plan.stayAddress ?? "").trim().length < 2) {
        return "Type your hotel name or stay address, or choose “I don’t know yet”.";
      }
    }
    if (title === "Naps & Food" && !isWizardStepComplete(plan, title)) {
      return "Add a nap window, or choose “No naps needed.”";
    }
    if (!isWizardStepComplete(plan, title)) {
      return "Almost there — just fill in what's missing and we'll keep going.";
    }
    return null;
  }

  async function goNext() {
    if (advancingRef.current || isLastStep) return;

    const fromIndex = stepIndex;
    const stepError = getStepError(formData, WIZARD_STEP_TITLES[fromIndex]!);
    if (stepError) {
      setError(stepError);
      return;
    }

    advancingRef.current = true;
    setIsAdvancing(true);
    try {
      if (WIZARD_STEP_TITLES[fromIndex] === "Stay") {
        setError("");
        const { resolveStayFromText } = await import("@/lib/planning-engine/resolve-stay");
        const resolved = await resolveStayFromText(formData);
        if (resolved) {
          setFormData((current) => ({ ...current, ...resolved }));
        }
      }

      markPlannerStarted();
      // Load next applicable step first, then swap — avoids a blank dynamic() flash.
      const next = findAdjacentWizardStep(fromIndex, "forward", formData);
      await goToStep(next, "forward");
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      advancingRef.current = false;
      setIsAdvancing(false);
    }
  }

  async function callGenerateApi(params: GenerateParams = {}) {
    let plan = { ...formData, ...params.planOverride };
    const demo = params.demo ?? useDemoNext;

    setIsLoading(true);
    setLoadingMessage(params.loadingMessage);
    setError("");

    try {
      const { resolveStayFromText } = await import("@/lib/planning-engine/resolve-stay");
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

      const { demo: _demo, transportationType: effectiveTransport, ...itineraryData } =
        data as Itinerary & {
          demo?: boolean;
          transportationType?: TripPlan["transportationType"];
        };
      setItinerary(itineraryData as Itinerary);
      setIsDemo(demo || Boolean(data.demo));
      trackItineraryGenerated(itineraryProductProps(plan));

      if (effectiveTransport && effectiveTransport !== formData.transportationType) {
        setFormData((current) => ({
          ...current,
          transportationType: effectiveTransport,
        }));
      }

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
    const incomplete = findFirstIncompleteWizardStep(formData);
    if (incomplete !== null) {
      void (async () => {
        await goToStep(incomplete, "back");
        setError(
          getStepError(formData, WIZARD_STEP_TITLES[incomplete]!) ??
            "Almost there — just fill in what's missing and we'll keep going.",
        );
      })();
      return;
    }
    trackPlannerCompleted(itineraryProductProps(formData));
    setUseDemoNext(demo);
    callGenerateApi({ demo });
  }

  function resetWizard() {
    setItinerary(null);
    setIsDemo(false);
    setStepComponent(() => DestinationStep);
    setStepIndex(0);
    setStepDirection("forward");
    setFormData(initialTripPlan);
    setError("");
    plannerStartedRef.current = false;
    lastStepViewedRef.current = null;
    lastItineraryViewedKeyRef.current = null;
  }

  function applyPlanUpdateFromChips(updates: Partial<TripPlan>) {
    const nextPlan = { ...formData, ...updates };
    setFormData(nextPlan);
    callGenerateApi({
      planOverride: nextPlan,
      demo: isDemo,
      loadingMessage: "Updating your trip…",
    });
  }

  function editPlanInWizard(nextStepIndex: number, updates?: Partial<TripPlan>) {
    if (updates) {
      setFormData((current) => ({ ...current, ...updates }));
    }
    setItinerary(null);
    setIsDemo(false);
    void (async () => {
      await goToStep(nextStepIndex, "back");
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    })();
  }

  function handleStepKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || isLoading || continueBusy) return;
    const target = e.target as HTMLElement;
    // Let textareas take literal newlines, and let a focused button handle its own Enter activation.
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    e.preventDefault();
    if (isLastStep) {
      handleGenerate(false);
    } else {
      void goNext();
    }
  }

  if (isLoading && !itinerary) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2.5 text-primary transition hover:opacity-80"
          >
            <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
            <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
            <LoadingScreen message={loadingMessage} />
          </div>
        </div>
      </main>
    );
  }

  if (itinerary) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-primary transition hover:opacity-80"
          >
            <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
            <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>

          <div className="relative mt-6 rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
            {error && (
              <p className="mb-4 rounded-2xl border border-error/20 bg-error-muted px-4 py-3.5 text-sm leading-relaxed text-error">
                {error}
              </p>
            )}
            <ItineraryDisplay
              key={[
                formData.travelStyle,
                formData.budgetStyle,
                formData.naps == null
                  ? "unset"
                  : formData.naps.map((n) => `${n.startTime}-${n.endTime}-${n.type}`).join("|"),
                formData.transportationType,
                formData.accommodationType,
                formData.interests.join("|"),
              ].join("::")}
              itinerary={itinerary}
              plan={formData}
              isDemo={isDemo}
              isLoading={isLoading}
              onApplyPlanUpdate={applyPlanUpdateFromChips}
              onEditPlanInWizard={editPlanInWizard}
              onPlanAnother={resetWizard}
            />
          </div>
        </div>
        <BackToTopButton />
      </main>
    );
  }

  return (
    <>
      <WizardShell
        stepIndex={visiblePosition - 1}
        totalSteps={visibleTotal}
        stepTitle={currentTitle}
        footer={
          <>
            {error && (
              <p className="mt-6 rounded-2xl border border-error/20 bg-error-muted px-4 py-3.5 text-sm leading-relaxed text-error">
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={() => void goBack()}
                  disabled={isLoading || continueBusy}
                  className={`order-2 sm:order-1 sm:flex-1 ${btnSecondaryClassName}`}
                >
                  Back
                </button>
              )}

              {isLastStep ? (
                <div className="order-1 flex w-full flex-col gap-3 sm:order-2 sm:flex-1">
                  <button
                    type="button"
                    onClick={() => handleGenerate(false)}
                    disabled={isLoading || continueBusy}
                    className={`w-full ${btnCtaClassName}`}
                  >
                    Generate itinerary
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={isLoading || continueBusy}
                    className={`w-full ${btnGhostClassName}`}
                  >
                    Try demo (free, no API key)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={continueBusy}
                  className={`order-1 w-full sm:flex-1 ${btnPrimaryClassName}`}
                >
                  {continueBusy ? "One moment…" : "Sounds good →"}
                </button>
              )}
            </div>
          </>
        }
      >
        <div onKeyDown={handleStepKeyDown}>
          <StepTransition stepKey={stepIndex} direction={stepDirection}>
            <StepComponent
              formData={formData}
              updateFormData={updateFormData}
              setStepBusy={setIsStepBusy}
            />
          </StepTransition>
        </div>
      </WizardShell>
      <BackToTopButton />
    </>
  );
}
