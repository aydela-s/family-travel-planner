"use client";

import { DesignLabChrome } from "./chrome";
import { DesignLabCompare } from "./compare";
import { isLabConceptId, type LabConceptId, type LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { DesignLabHub } from "./hub";
import { DesignLabProvider } from "./state";
import { ChipsOptionsPage } from "./chips-options";
import { FontsOptionsPage } from "./fonts-options";
import { FoodNapsOptionsPage } from "./food-naps-options";
import { InterestsOptionsPage } from "./interests-options";
import { LoadingOptionsPage } from "./loading-options";
import { HomepageOptionsPage } from "./homepage-options";
import { MobileOptionsPage } from "./mobile-options";
import { PaceBudgetOptionsPage } from "./pace-budget-options";
import { StayOptionsPage } from "./stay-options";
import { TravelersOptionsPage } from "./travelers-options";
import { WizardStepOptionsPage } from "./wizard-step-options";

export function DesignLabApp({ slug }: { slug?: string[] }) {
  const parsed = parseLabSlug(slug);

  return (
    <DesignLabProvider conceptId={parsed.conceptId ?? "ledger"} screen={parsed.screen === "wizard" || parsed.screen === "itinerary" || parsed.screen === "home" ? parsed.screen : "home"}>
      <div className="min-h-screen bg-slate-100">
        <DesignLabChrome conceptId={parsed.conceptId} screen={parsed.chrome} />
        {parsed.kind === "hub" ? <DesignLabHub /> : null}
        {parsed.kind === "compare" ? <DesignLabCompare /> : null}
        {parsed.kind === "wizard-steps" ? <WizardStepOptionsPage /> : null}
        {parsed.kind === "travelers" ? <TravelersOptionsPage /> : null}
        {parsed.kind === "stay" ? <StayOptionsPage /> : null}
        {parsed.kind === "food-naps" ? <FoodNapsOptionsPage /> : null}
        {parsed.kind === "interests" ? <InterestsOptionsPage /> : null}
        {parsed.kind === "pace-budget" ? <PaceBudgetOptionsPage /> : null}
        {parsed.kind === "fonts" ? <FontsOptionsPage /> : null}
        {parsed.kind === "loading" ? <LoadingOptionsPage /> : null}
        {parsed.kind === "chips" ? <ChipsOptionsPage /> : null}
        {parsed.kind === "mobile" ? <MobileOptionsPage /> : null}
        {parsed.kind === "homepage" ? <HomepageOptionsPage /> : null}
        {parsed.kind === "concept" && parsed.conceptId ? (
          <ConceptScreen conceptId={parsed.conceptId} screen={parsed.screen as LabScreen} />
        ) : null}
      </div>
    </DesignLabProvider>
  );
}

function parseLabSlug(slug?: string[]): {
  kind: "hub" | "compare" | "wizard-steps" | "travelers" | "stay" | "food-naps" | "interests" | "pace-budget" | "fonts" | "loading" | "chips" | "mobile" | "homepage" | "concept";
  conceptId?: LabConceptId;
  screen?: LabScreen;
  chrome: LabScreen | "hub" | "compare" | "wizard-steps" | "travelers" | "stay" | "food-naps" | "interests" | "pace-budget" | "fonts" | "loading" | "chips" | "mobile" | "homepage";
} {
  if (!slug || slug.length === 0) {
    return { kind: "hub", chrome: "hub" };
  }
  if (slug[0] === "compare") {
    return { kind: "compare", chrome: "compare" };
  }
  if (slug[0] === "wizard-steps") {
    return { kind: "wizard-steps", chrome: "wizard-steps" };
  }
  if (slug[0] === "travelers") {
    return { kind: "travelers", chrome: "travelers" };
  }
  if (slug[0] === "stay") {
    return { kind: "stay", chrome: "stay" };
  }
  if (slug[0] === "food-naps") {
    return { kind: "food-naps", chrome: "food-naps" };
  }
  if (slug[0] === "interests") {
    return { kind: "interests", chrome: "interests" };
  }
  if (slug[0] === "pace-budget") {
    return { kind: "pace-budget", chrome: "pace-budget" };
  }
  if (slug[0] === "fonts") {
    return { kind: "fonts", chrome: "fonts" };
  }
  if (slug[0] === "loading") {
    return { kind: "loading", chrome: "loading" };
  }
  if (slug[0] === "chips") {
    return { kind: "chips", chrome: "chips" };
  }
  if (slug[0] === "mobile") {
    return { kind: "mobile", chrome: "mobile" };
  }
  if (slug[0] === "homepage") {
    return { kind: "homepage", chrome: "homepage" };
  }
  if (!isLabConceptId(slug[0])) {
    return { kind: "hub", chrome: "hub" };
  }
  const conceptId = slug[0];
  const page = slug[1];
  const screen: LabScreen = page === "plan" ? "wizard" : page === "trip" ? "itinerary" : "home";
  return { kind: "concept", conceptId, screen, chrome: screen };
}
