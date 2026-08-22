"use client";

import Link from "next/link";
import { LAB_CONCEPTS, MIX_CONCEPT_IDS, ORIGINAL_CONCEPT_IDS, conceptPath, type LabConceptId } from "./concepts";

export function DesignLabHub() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm font-medium text-[#016d76]">Development only</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">FamilyTravely Design Lab</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Three new mixes keep the Ledger homepage and wizard structure, with product type and color, then combine the
          Week Board itinerary, day-by-day viewing, and the Atlas map.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/design-lab/vs" className="rounded-full bg-[#016d76] px-4 py-2 text-sm font-semibold text-white">
            Harbor vs current UI
          </Link>
          <Link href="/design-lab/signals" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Harbor vs signals
          </Link>
          <Link href="/design-lab/mix" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Signals UI
          </Link>
          <Link href={conceptPath("harbor")} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Open Harbor
          </Link>
          <Link href="/design-lab/wizard-steps" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Wizard step options
          </Link>
          <Link href="/design-lab/travelers" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Travelers options
          </Link>
          <Link href="/design-lab/stay" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Stay options
          </Link>
          <Link href="/design-lab/food-naps" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Food & naps options
          </Link>
          <Link href="/design-lab/interests" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Interests options
          </Link>
          <Link href="/design-lab/pace-budget" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Pace & budget options
          </Link>
          <Link href="/design-lab/fonts" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Font styles
          </Link>
          <Link href="/design-lab/loading" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Loading options
          </Link>
          <Link href="/design-lab/chips" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Chip options
          </Link>
          <Link href="/design-lab/mobile" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Mobile options
          </Link>
          <Link href="/design-lab/homepage" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Homepage options
          </Link>
          <Link href="/design-lab/compare" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200">
            Compare all
          </Link>
        </div>

        <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-[#016d76]">Your mix — 3 options</h2>
        <ol className="mt-4 space-y-6">
          {MIX_CONCEPT_IDS.map((id, index) => (
            <ConceptCard key={id} id={id} label={`Option ${index + 1}`} />
          ))}
        </ol>

        <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-slate-400">Original exploration</h2>
        <ol className="mt-4 space-y-6">
          {ORIGINAL_CONCEPT_IDS.map((id, index) => (
            <ConceptCard key={id} id={id} label={`Concept ${index + 1}`} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function ConceptCard({ id, label }: { id: LabConceptId; label: string }) {
  const concept = LAB_CONCEPTS[id];
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <h3 className="mt-1 text-xl font-semibold">{concept.name}</h3>
      <p className="mt-2 text-slate-600">{concept.oneLiner}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-500">Hierarchy</dt>
          <dd className="mt-1 text-slate-700">{concept.hierarchy}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Why it differs</dt>
          <dd className="mt-1 text-slate-700">{concept.differs}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={conceptPath(id, "home")} className="text-sm font-medium text-[#016d76]">
          Homepage
        </Link>
        <span className="text-slate-300">·</span>
        <Link href={conceptPath(id, "wizard")} className="text-sm font-medium text-[#016d76]">
          Wizard
        </Link>
        <span className="text-slate-300">·</span>
        <Link href={conceptPath(id, "itinerary")} className="text-sm font-medium text-[#016d76]">
          Itinerary
        </Link>
      </div>
    </li>
  );
}
