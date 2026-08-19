"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LAB_CONCEPTS, LAB_CONCEPT_IDS, LAB_SCREENS, MIX_CONCEPT_IDS, conceptPath, type LabConceptId, type LabScreen } from "./concepts";
import { ConceptScreen } from "./concepts/render";
import { LAB_WIZARD_SECTIONS } from "./lib/wizard-options";
import { useDesignLab } from "./state";

function PreviewFrame({
  conceptId,
  screen,
  scale = 0.38,
}: {
  conceptId: LabConceptId;
  screen: LabScreen;
  scale?: number;
}) {
  const width = `${(100 / scale).toFixed(2)}%`;
  return (
    <div className="relative h-[28rem] overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        className="origin-top-left"
        style={{ transform: `scale(${scale})`, width }}
      >
        <ConceptScreen conceptId={conceptId} screen={screen} />
      </div>
      <Link
        href={conceptPath(conceptId, screen)}
        className="absolute bottom-2 right-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
      >
        Open {LAB_CONCEPTS[conceptId].shortName}
      </Link>
    </div>
  );
}

export function DesignLabCompare() {
  const { goStep, stepIndex } = useDesignLab();
  const [screen, setScreen] = useState<LabScreen>("itinerary");
  const [left, setLeft] = useState<LabConceptId>("harbor");
  const [right, setRight] = useState<LabConceptId>("daylight");
  const [mode, setMode] = useState<"all" | "pair" | "mix">("all");
  const [setFilter, setSetFilter] = useState<"mix" | "all">("mix");
  const [mixHome, setMixHome] = useState<LabConceptId>("journal");
  const [mixWizard, setMixWizard] = useState<LabConceptId>("ledger");
  const [mixTrip, setMixTrip] = useState<LabConceptId>("board");
  const [mixScreen, setMixScreen] = useState<LabScreen>("home");

  const mixConcept = useMemo(() => {
    if (mixScreen === "home") return mixHome;
    if (mixScreen === "wizard") return mixWizard;
    return mixTrip;
  }, [mixHome, mixScreen, mixTrip, mixWizard]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-[90rem]">
        <h1 className="text-2xl font-semibold">Compare</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Same Dallas trip in every pane. Harbor, Route, and Daylight are the three mixes of Ledger structure + Week Board + day view + map.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {LAB_SCREENS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScreen(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                screen === item.id && mode !== "mix" ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
          {(["all", "pair", "mix"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                mode === item ? "bg-[#016d76] text-white" : "bg-white ring-1 ring-slate-200"
              }`}
            >
              {item === "all" ? "Grid" : item === "pair" ? "Side by side" : "Assemble"}
            </button>
          ))}
        </div>

        {screen === "wizard" && mode !== "mix" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {LAB_WIZARD_SECTIONS.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => goStep(index)}
                className={`rounded px-2 py-1 text-xs ${
                  stepIndex === index ? "bg-[#e6f3f4] font-semibold text-[#016d76]" : "text-slate-500"
                }`}
              >
                {index + 1}. {section.title}
              </button>
            ))}
          </div>
        ) : null}

        {mode === "all" ? (
          <div className="mt-4">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSetFilter("mix")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${setFilter === "mix" ? "bg-[#016d76] text-white" : "bg-white ring-1 ring-slate-200"}`}
              >
                Your mix
              </button>
              <button
                type="button"
                onClick={() => setSetFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${setFilter === "all" ? "bg-[#016d76] text-white" : "bg-white ring-1 ring-slate-200"}`}
              >
                All concepts
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(setFilter === "mix" ? MIX_CONCEPT_IDS : LAB_CONCEPT_IDS).map((id) => (
                <div key={id}>
                  <p className="mb-2 text-sm font-semibold">{LAB_CONCEPTS[id].name}</p>
                  <PreviewFrame conceptId={id} screen={screen} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mode === "pair" ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <SelectConcept value={left} onChange={setLeft} />
              <PreviewFrame conceptId={left} screen={screen} scale={0.48} />
            </div>
            <div>
              <SelectConcept value={right} onChange={setRight} />
              <PreviewFrame conceptId={right} screen={screen} scale={0.48} />
            </div>
          </div>
        ) : null}

        {mode === "mix" ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Homepage
                <SelectConcept value={mixHome} onChange={setMixHome} />
              </label>
              <label className="text-sm">
                Wizard
                <SelectConcept value={mixWizard} onChange={setMixWizard} />
              </label>
              <label className="text-sm">
                Itinerary
                <SelectConcept value={mixTrip} onChange={setMixTrip} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {LAB_SCREENS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMixScreen(item.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    mixScreen === item.id ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"
                  }`}
                >
                  Preview {item.label.toLowerCase()}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              Showing <strong>{LAB_CONCEPTS[mixConcept].name}</strong> for the {mixScreen} screen. Open the real flow
              with those picks:
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href={conceptPath(mixHome, "home")} className="text-[#016d76]">
                Open homepage ({LAB_CONCEPTS[mixHome].shortName})
              </Link>
              <Link href={conceptPath(mixWizard, "wizard")} className="text-[#016d76]">
                Open wizard ({LAB_CONCEPTS[mixWizard].shortName})
              </Link>
              <Link href={conceptPath(mixTrip, "itinerary")} className="text-[#016d76]">
                Open itinerary ({LAB_CONCEPTS[mixTrip].shortName})
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <ConceptScreen conceptId={mixConcept} screen={mixScreen} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SelectConcept({
  value,
  onChange,
}: {
  value: LabConceptId;
  onChange: (id: LabConceptId) => void;
}) {
  return (
    <select
      className="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as LabConceptId)}
    >
      {LAB_CONCEPT_IDS.map((id) => (
        <option key={id} value={id}>
          {LAB_CONCEPTS[id].name}
        </option>
      ))}
    </select>
  );
}
