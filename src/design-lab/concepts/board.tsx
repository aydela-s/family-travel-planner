"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import Link from "next/link";
import { useState } from "react";
import { conceptPath } from "../concepts";
import { DALLAS_PLAN } from "../fixtures/dallas";
import {
  activityKindLabel,
  formatClockCompact,
  moneyWhole,
  planFacts,
  tripTotals,
  visibleStops,
} from "../lib/helpers";
import { LAB_WIZARD_SECTIONS } from "../lib/wizard-options";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";
import type { ItineraryActivity } from "@/types/itinerary";

export function BoardHome() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <FamilyTravelyLogo variant="mark" className="h-8 w-auto" />
        <Link href={conceptPath("board", "wizard")} className="rounded bg-[#016d76] px-4 py-2 text-sm font-semibold text-white">
          Open trip desk
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-sm font-medium text-[#016d76]">Week board</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight">
          See the whole trip before you fall in love with a single day.
        </h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Compare the museum day to the water day. Spot the long Grapevine taxi. Treat planning like a family calendar, not a funnel.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-4">
          {["Mon · Museum", "Tue · Water", "Wed · Mills", "Thu · Park"].map((label, index) => (
            <div key={label} className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">Day {index + 1}</p>
              <p className="mt-2 font-medium">{label}</p>
              <div className="mt-4 space-y-2">
                <div className="h-10 rounded bg-[#e6f3f4]" />
                <div className="h-8 rounded bg-[#ffecec]" />
                <div className="h-6 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export function BoardWizard() {
  const { stepIndex, goStep, canGenerate, firstIncomplete } = useDesignLab();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <FamilyTravelyLogo variant="mark" className="h-7 w-auto" />
          <p className="text-sm font-semibold">Trip desk</p>
        </div>
        <Link
          href={canGenerate ? conceptPath("board", "itinerary") : "#"}
          className={`rounded px-4 py-2 text-sm font-semibold text-white ${canGenerate ? "bg-[#ff5757]" : "pointer-events-none bg-slate-300"}`}
        >
          Build board
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav className="border-b border-slate-200 bg-white lg:min-h-[calc(100vh-3.25rem)] lg:border-b-0 lg:border-r">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Topics</p>
          <ol>
            {LAB_WIZARD_SECTIONS.map((section, index) => {
              const done = firstIncomplete === null || index < (firstIncomplete ?? 99);
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => goStep(index)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${
                      index === stepIndex ? "bg-[#e6f3f4] font-semibold text-[#016d76]" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${done && index !== firstIncomplete ? "bg-[#016d76]" : "bg-slate-300"}`}
                    />
                    {section.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="p-6">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <WizardStepFields skin="board" index={stepIndex} />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Jump anywhere. Generate stays blocked until every topic is complete — same rules as production.
          </p>
        </div>
      </div>
    </div>
  );
}

function blockTone(type: ItineraryActivity["type"]) {
  if (type === "meal") return "border-l-4 border-l-[#ff5757] bg-white";
  if (type === "nap" || type === "rest") return "border-l-4 border-l-[#02bbcb] bg-white";
  return "border-l-4 border-l-[#016d76] bg-white";
}

export function BoardItinerary() {
  const { itinerary, downloadPdf } = useDesignLab();
  const facts = planFacts(DALLAS_PLAN);
  const totals = tripTotals(itinerary);
  const maxDay = Math.max(...itinerary.days.map((day) => day.costBreakdown.total), 1);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Dallas · {facts.when}</h1>
            <p className="text-xs text-slate-500">
              {facts.party} · {facts.stay} · {facts.transit}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Trip total</p>
              <p className="text-xl font-semibold">{moneyWhole(totals.total)}</p>
            </div>
            <button type="button" onClick={() => void downloadPdf()} className="text-sm text-[#016d76]">
              Download
            </button>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto px-4 pb-3">
          {itinerary.days.map((day) => (
            <div key={day.date} className="min-w-[7rem] flex-1">
              <p className="text-[11px] text-slate-500">
                Day {day.day} · {moneyWhole(day.costBreakdown.total)}
              </p>
              <div className="mt-1 h-2 rounded bg-slate-200">
                <div
                  className="h-2 rounded bg-[#016d76]"
                  style={{ width: `${Math.max(12, (day.costBreakdown.total / maxDay) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="flex gap-3 overflow-x-auto p-4">
        {itinerary.days.map((day) => (
          <section key={day.date} className="w-[min(100%,18rem)] shrink-0 sm:w-72">
            <h2 className="mb-2 text-sm font-semibold">
              {day.weekday} {day.date.slice(-2)}
              <span className="mt-0.5 block text-xs font-normal text-slate-500">{day.displayTitle}</span>
            </h2>
            <div className="space-y-2">
              {visibleStops(day).map((activity) => {
                const key = `${day.day}-${activity.time}-${activity.title}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpen(open === key ? null : key)}
                    className={`w-full rounded-md p-3 text-left shadow-sm ${blockTone(activity.type)}`}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {formatClockCompact(activity.time)} · {activityKindLabel(activity.type)}
                    </p>
                    <p className="mt-1 text-sm font-medium">{activity.title}</p>
                    {activity.activityCost ? (
                      <p className="mt-1 text-xs text-slate-500">{moneyWhole(activity.activityCost)}</p>
                    ) : null}
                    {open === key && activity.notes ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{activity.notes}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
