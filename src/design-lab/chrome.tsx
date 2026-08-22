"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LAB_CONCEPTS,
  LAB_SCREENS,
  MIX_CONCEPT_IDS,
  ORIGINAL_CONCEPT_IDS,
  conceptPath,
  type LabConceptId,
  type LabScreen,
} from "./concepts";

export function DesignLabChrome({
  conceptId,
  screen,
  navBasePath,
}: {
  conceptId?: LabConceptId;
  screen?: LabScreen | "hub" | "compare" | "wizard-steps" | "travelers" | "stay" | "food-naps" | "interests" | "pace-budget" | "fonts" | "loading" | "chips" | "mobile" | "homepage" | "vs" | "signals";
  navBasePath?: string;
}) {
  const pathname = usePathname();
  const onCompare = pathname.startsWith("/design-lab/compare");
  const onWizardSteps = pathname.startsWith("/design-lab/wizard-steps");
  const onTravelers = pathname.startsWith("/design-lab/travelers");
  const onStay = pathname.startsWith("/design-lab/stay");
  const onFoodNaps = pathname.startsWith("/design-lab/food-naps");
  const onInterests = pathname.startsWith("/design-lab/interests");
  const onPaceBudget = pathname.startsWith("/design-lab/pace-budget");
  const onFonts = pathname.startsWith("/design-lab/fonts");
  const onLoading = pathname.startsWith("/design-lab/loading");
  const onChips = pathname.startsWith("/design-lab/chips");
  const onMobile = pathname.startsWith("/design-lab/mobile");
  const onHomepage = pathname.startsWith("/design-lab/homepage");
  const onVs = pathname.startsWith("/design-lab/vs");
  const onSignals = pathname === "/design-lab/signals" || pathname.startsWith("/design-lab/signals/");
  const onMix = pathname === "/design-lab/mix" || pathname.startsWith("/design-lab/mix/");
  const preserveScreen = screen === "home" || screen === "wizard" || screen === "itinerary";

  return (
    <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-900 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Link href="/design-lab" className="text-sm font-semibold tracking-tight">
          FamilyTravely Design Lab
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/design-lab/vs"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onVs ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Harbor vs current
          </Link>
          <Link
            href="/design-lab/signals"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onSignals ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Harbor vs signals
          </Link>
          <Link
            href="/design-lab/mix"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onMix ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Signals UI
          </Link>
          <Link
            href="/design-lab/wizard-steps"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onWizardSteps ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Step options
          </Link>
          <Link
            href="/design-lab/travelers"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onTravelers ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Travelers
          </Link>
          <Link
            href="/design-lab/stay"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onStay ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Stay
          </Link>
          <Link
            href="/design-lab/food-naps"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onFoodNaps ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Food & naps
          </Link>
          <Link
            href="/design-lab/interests"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onInterests ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Interests
          </Link>
          <Link
            href="/design-lab/pace-budget"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onPaceBudget ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Pace & budget
          </Link>
          <Link
            href="/design-lab/fonts"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onFonts ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Fonts
          </Link>
          <Link
            href="/design-lab/loading"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onLoading ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Loading
          </Link>
          <Link
            href="/design-lab/chips"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onChips ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Chips
          </Link>
          <Link
            href="/design-lab/mobile"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onMobile ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Mobile
          </Link>
          <Link
            href="/design-lab/homepage"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onHomepage ? "bg-[#016d76] text-white" : "bg-[#e6f3f4] text-[#016d76]"}`}
          >
            Homepage
          </Link>
          <Link
            href="/design-lab/compare"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${onCompare ? "bg-slate-900 text-white" : "bg-slate-100"}`}
          >
            Compare
          </Link>
          <span className="hidden text-[11px] text-slate-400 sm:inline">Dev only · production UI unchanged</span>
        </div>
      </div>
      <div className="px-2 pb-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-[#016d76]">Your mix</p>
        <div className="mt-1 flex gap-1 overflow-x-auto">
          {MIX_CONCEPT_IDS.map((id) => (
            <ConceptChip key={id} id={id} conceptId={conceptId} preserveScreen={preserveScreen} screen={screen} emphasis />
          ))}
        </div>
        <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Originals</p>
        <div className="mt-1 flex gap-1 overflow-x-auto">
          {ORIGINAL_CONCEPT_IDS.map((id) => (
            <ConceptChip key={id} id={id} conceptId={conceptId} preserveScreen={preserveScreen} screen={screen} />
          ))}
        </div>
      </div>
      {conceptId && screen && screen !== "hub" && screen !== "compare" && screen !== "wizard-steps" && screen !== "travelers" && screen !== "stay" && screen !== "food-naps" && screen !== "interests" && screen !== "pace-budget" && screen !== "fonts" && screen !== "loading" && screen !== "chips" && screen !== "mobile" && screen !== "homepage" && screen !== "vs" && screen !== "signals" ? (
        <div className="flex gap-1 border-t border-slate-100 px-2 py-1.5">
          {LAB_SCREENS.map((item) => (
            <Link
              key={item.id}
              href={navBasePath ? mixPath(navBasePath, item.id) : conceptPath(conceptId, item.id)}
              className={`rounded px-3 py-1 text-xs ${
                screen === item.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConceptChip({
  id,
  conceptId,
  screen,
  preserveScreen,
  emphasis,
}: {
  id: LabConceptId;
  conceptId?: LabConceptId;
  screen?: LabScreen | "hub" | "compare" | "wizard-steps" | "travelers" | "stay" | "food-naps" | "interests" | "pace-budget" | "fonts" | "loading" | "chips" | "mobile" | "homepage" | "vs" | "signals";
  preserveScreen: boolean;
  emphasis?: boolean;
}) {
  const active = conceptId === id;
  const href = preserveScreen && screen && screen !== "hub" && screen !== "compare" && screen !== "wizard-steps" && screen !== "travelers" && screen !== "stay" && screen !== "food-naps" && screen !== "interests" && screen !== "pace-budget" && screen !== "fonts" && screen !== "loading" && screen !== "chips" && screen !== "mobile" && screen !== "homepage" && screen !== "vs" && screen !== "signals"
    ? conceptPath(id, screen)
    : conceptPath(id);
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? "bg-[#016d76] text-white"
          : emphasis
            ? "bg-[#e6f3f4] text-[#016d76] hover:bg-[#d2ebee]"
            : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {LAB_CONCEPTS[id].shortName}
    </Link>
  );
}

function mixPath(base: string, screen: LabScreen) {
  if (screen === "home") return base;
  if (screen === "wizard") return `${base}/plan`;
  return `${base}/trip`;
}
