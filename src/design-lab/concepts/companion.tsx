"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import { useMemo, useState } from "react";
import { conceptPath } from "../concepts";
import { DALLAS_PLAN } from "../fixtures/dallas";
import { formatClock, moneyWhole, planFacts, tripTotals, visibleStops } from "../lib/helpers";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";

export function CompanionHome() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f4f7f7] text-slate-900">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-16 text-center">
        <FamilyTravelyLogo className="h-auto w-52" />
        <h1 className="mt-10 max-w-sm text-3xl font-semibold tracking-tight">
          What’s next for the kids — without opening a spreadsheet.
        </h1>
        <p className="mt-4 max-w-sm text-slate-600">
          A trip companion: now, next, and a quiet later. Built for the phone in your pocket.
        </p>
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4">
        <Link
          href={conceptPath("companion", "wizard")}
          className="flex min-h-14 items-center justify-center rounded-2xl bg-[#ff5757] text-base font-semibold text-white"
        >
          Plan this trip
        </Link>
        <p className="mt-2 text-center text-xs text-slate-500">Free · no account</p>
      </div>
    </div>
  );
}

export function CompanionWizard() {
  const { stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f4f7f7]">
      <div className="h-1 bg-slate-200">
        <div className="h-full bg-[#016d76]" style={{ width: `${((stepIndex + 1) / 6) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <FamilyTravelyLogo variant="mark" className="h-8 w-auto" />
        <p className="text-xs font-medium text-slate-500">{stepIndex + 1} / 6</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-4">
        <WizardStepFields skin="companion" index={stepIndex} />
      </div>
      <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white p-4">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => goStep(stepIndex - 1)}
          className="min-h-14 rounded-2xl bg-white text-base font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-30"
        >
          Back
        </button>
        {last ? (
          <Link
            href={canGenerate ? conceptPath("companion", "itinerary") : "#"}
            className={`flex min-h-14 items-center justify-center rounded-2xl text-base font-semibold text-white ${canGenerate ? "bg-[#ff5757]" : "pointer-events-none bg-slate-300"}`}
          >
            Show plan
          </Link>
        ) : (
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => goStep(stepIndex + 1)}
            className="min-h-14 rounded-2xl bg-[#016d76] text-base font-semibold text-white disabled:bg-slate-300"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

export function CompanionItinerary() {
  const { itinerary, downloadPdf } = useDesignLab();
  const [dayIndex, setDayIndex] = useState(0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const day = itinerary.days[dayIndex]!;
  const stops = visibleStops(day);
  const now = stops[0];
  const next = stops[1];
  const later = stops.slice(2);
  const totals = tripTotals(itinerary);
  const facts = planFacts(DALLAS_PLAN);

  const nowLabel = useMemo(() => (now?.type === "meal" ? "First up" : "Now"), [now]);

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f4f7f7] pb-16 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">{itinerary.destinationCity}</p>
          <h1 className="text-lg font-semibold">{day.weekday}</h1>
        </div>
        <button type="button" onClick={() => setBudgetOpen(true)} className="rounded-full bg-white px-3 py-1 text-sm font-semibold ring-1 ring-slate-200">
          {moneyWhole(totals.total)}
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {itinerary.days.map((item, index) => (
          <button
            key={item.date}
            type="button"
            onClick={() => setDayIndex(index)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              index === dayIndex ? "bg-[#016d76] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {item.weekday.slice(0, 3)} {item.date.slice(-2)}
          </button>
        ))}
      </div>

      {now ? (
        <section className="mx-4 rounded-3xl bg-[#016d76] p-5 text-white">
          <p className="text-xs uppercase tracking-widest text-white/70">{nowLabel}</p>
          <p className="mt-1 text-sm text-white/80">{formatClock(now.time)}</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight">{now.title}</h2>
          {now.notes ? <p className="mt-3 text-sm text-white/80">{now.notes}</p> : null}
        </section>
      ) : null}

      {next ? (
        <section className="mx-4 mt-3 rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#ff5757]">Next</p>
          <p className="mt-1 text-sm text-slate-500">{formatClock(next.time)}</p>
          <h3 className="mt-1 text-xl font-semibold">{next.title}</h3>
        </section>
      ) : null}

      <section className="mx-4 mt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Later</p>
        <ul className="mt-2 divide-y divide-slate-200 rounded-2xl bg-white">
          {later.map((activity) => (
            <li key={`${activity.time}-${activity.title}`} className="flex items-start gap-3 px-4 py-3">
              <span className="w-16 shrink-0 text-xs font-medium text-slate-500">{formatClock(activity.time)}</span>
              <span className="flex-1 text-sm font-medium">{activity.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t border-slate-200 bg-white text-center text-xs font-medium">
        <Link href={conceptPath("companion", "home")} className="py-3 text-slate-500">
          Home
        </Link>
        <span className="py-3 text-[#016d76]">Today</span>
        <button type="button" onClick={() => void downloadPdf()} className="py-3 text-slate-500">
          Save
        </button>
      </nav>

      {budgetOpen ? (
        <div className="fixed inset-0 z-20 bg-black/40" onClick={() => setBudgetOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold">Estimated spend</p>
            <p className="mt-1 text-3xl font-semibold">{moneyWhole(totals.total)}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Activities</dt>
                <dd>{moneyWhole(totals.activities)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Transport</dt>
                <dd>{moneyWhole(totals.transport)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Food</dt>
                <dd>{moneyWhole(totals.food)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">{itinerary.pricingDisclaimer}</p>
            <p className="mt-2 text-xs text-slate-400">{facts.budget} style</p>
            <button
              type="button"
              onClick={() => setBudgetOpen(false)}
              className="mt-5 min-h-12 w-full rounded-2xl bg-slate-100 font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
