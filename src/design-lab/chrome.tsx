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
  screen?: LabScreen | "hub" | "compare" | "vs" | "signals";
  navBasePath?: string;
}) {
  const pathname = usePathname();
  const onCompare = pathname.startsWith("/design-lab/compare");
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
      {conceptId && screen && screen !== "hub" && screen !== "compare" && screen !== "vs" && screen !== "signals" ? (
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
  screen?: LabScreen | "hub" | "compare" | "vs" | "signals";
  preserveScreen: boolean;
  emphasis?: boolean;
}) {
  const active = conceptId === id;
  const href = preserveScreen && screen && screen !== "hub" && screen !== "compare" && screen !== "vs" && screen !== "signals"
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
