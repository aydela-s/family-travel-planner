"use client";

import { downloadItineraryPdf } from "@/lib/itinerary-pdf";
import { findFirstIncompleteWizardStep, isWizardStepComplete, WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { walkingLimitFromTravelStyle, type AccommodationType, type TripPlan } from "@/types/trip-plan";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LabConceptId, LabScreen } from "./concepts";
import { DALLAS_ITINERARY, DALLAS_PLAN } from "./fixtures/dallas";
import { stayCategoryFromType, type StayCategoryId } from "./lib/wizard-options";

type DesignLabContextValue = {
  conceptId: LabConceptId;
  screen: LabScreen;
  stepIndex: number;
  plan: TripPlan;
  itinerary: typeof DALLAS_ITINERARY;
  stayCategory: StayCategoryId | "";
  setStayCategory: (category: StayCategoryId | "") => void;
  updatePlan: (updates: Partial<TripPlan>) => void;
  setStepIndex: (index: number) => void;
  goStep: (index: number) => void;
  canContinue: boolean;
  canGenerate: boolean;
  firstIncomplete: number | null;
  resetPlan: () => void;
  downloadPdf: () => Promise<void>;
};

const DesignLabContext = createContext<DesignLabContextValue | null>(null);

export function DesignLabProvider({
  conceptId,
  screen,
  children,
}: {
  conceptId: LabConceptId;
  screen: LabScreen;
  children: ReactNode;
}) {
  const [plan, setPlan] = useState<TripPlan>(DALLAS_PLAN);
  const [stepIndex, setStepIndex] = useState(0);
  const [stayCategory, setStayCategory] = useState<StayCategoryId | "">(
    stayCategoryFromType(DALLAS_PLAN.accommodationType),
  );

  const updatePlan = useCallback((updates: Partial<TripPlan>) => {
    setPlan((current) => {
      const next = { ...current, ...updates };
      if (updates.travelStyle) {
        next.walkingLimit = walkingLimitFromTravelStyle(updates.travelStyle);
      }
      return next;
    });
  }, []);

  const goStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(WIZARD_STEP_TITLES.length - 1, index)));
  }, []);

  const firstIncomplete = useMemo(() => findFirstIncompleteWizardStep(plan), [plan]);
  const canContinue = isWizardStepComplete(plan, WIZARD_STEP_TITLES[stepIndex]!);
  const canGenerate = firstIncomplete === null;

  const resetPlan = useCallback(() => {
    setPlan(DALLAS_PLAN);
    setStayCategory(stayCategoryFromType(DALLAS_PLAN.accommodationType));
    setStepIndex(0);
  }, []);

  const downloadPdf = useCallback(async () => {
    await downloadItineraryPdf({ itinerary: DALLAS_ITINERARY, plan: DALLAS_PLAN });
  }, []);

  const value = useMemo(
    () => ({
      conceptId,
      screen,
      stepIndex,
      plan,
      itinerary: DALLAS_ITINERARY,
      stayCategory,
      setStayCategory,
      updatePlan,
      setStepIndex,
      goStep,
      canContinue,
      canGenerate,
      firstIncomplete,
      resetPlan,
      downloadPdf,
    }),
    [
      canContinue,
      canGenerate,
      conceptId,
      firstIncomplete,
      plan,
      screen,
      stayCategory,
      stepIndex,
      updatePlan,
      goStep,
      resetPlan,
      downloadPdf,
    ],
  );

  return <DesignLabContext.Provider value={value}>{children}</DesignLabContext.Provider>;
}

export function useDesignLab() {
  const value = useContext(DesignLabContext);
  if (!value) throw new Error("useDesignLab must be used inside DesignLabProvider");
  return value;
}

export function applyStayCategory(
  category: StayCategoryId,
  updatePlan: (updates: Partial<TripPlan>) => void,
  setStayCategory: (category: StayCategoryId | "") => void,
) {
  setStayCategory(category);
  if (category === "friends") {
    updatePlan({ accommodationType: "staying_with_family_or_friends" });
    return;
  }
  if (category === "dont_know") {
    updatePlan({
      accommodationType: "dont_know_yet",
      stayAddress: "",
      stayPlaceId: "",
      stayLat: null,
      stayLng: null,
    });
    return;
  }
  updatePlan({ accommodationType: "" });
}

export function applyStayType(
  type: AccommodationType,
  updatePlan: (updates: Partial<TripPlan>) => void,
  setStayCategory: (category: StayCategoryId | "") => void,
) {
  setStayCategory(stayCategoryFromType(type));
  updatePlan({ accommodationType: type });
}

export function stayAddressRequired(plan: TripPlan) {
  return !isStayNotBookedYet(plan);
}
