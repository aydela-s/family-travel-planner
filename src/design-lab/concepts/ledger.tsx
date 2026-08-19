"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { BRAND } from "@/config/brand";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import { formatMiles } from "@/lib/format-distance";
import Link from "next/link";
import { conceptPath } from "../concepts";
import { DALLAS_PLAN } from "../fixtures/dallas";
import {
  activityKindLabel,
  dayHeadline,
  formatClock,
  moneyWhole,
  planFacts,
  tripTotals,
  visibleStops,
} from "../lib/helpers";
import { LAB_WIZARD_SECTIONS } from "../lib/wizard-options";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";

export function LedgerHome() {
  return (
    <div className="min-h-screen bg-[#f3eee4] text-stone-900">
      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="border-b border-stone-300 px-6 py-16 sm:px-12 lg:border-b-0 lg:border-r lg:py-24">
          <FamilyTravelyLogo className="h-auto w-48" />
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.28em] text-[#016d76]">
            {BRAND.slogan}
          </p>
          <h1 className="mt-6 max-w-xl font-[family-name:var(--font-lab-serif)] text-5xl leading-[1.1] text-stone-900 sm:text-6xl">
            A family itinerary you can read like a day sheet.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-600">
            Tell us the facts. We return a timed plan — meals, naps, and the one or two outings that actually fit.
          </p>
          <Link
            href={conceptPath("ledger", "wizard")}
            className="mt-10 inline-block border-b-2 border-[#ff5757] pb-1 text-lg font-medium text-stone-900"
          >
            Begin the trip brief →
          </Link>
        </section>
        <aside className="px-6 py-16 sm:px-12 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">How a brief becomes a day</p>
          <ol className="mt-8 space-y-8">
            {[
              ["01", "The facts", "City, dates, ages, stay, pace, naps."],
              ["02", "The sheets", "Each day is a timed ledger, not a stack of cards."],
              ["03", "The margin", "Spend sits in the right column, like a bill."],
            ].map(([n, title, body]) => (
              <li key={n} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-stone-300 pt-6">
                <span className="font-mono text-sm text-[#016d76]">{n}</span>
                <div>
                  <h2 className="font-[family-name:var(--font-lab-serif)] text-2xl">{title}</h2>
                  <p className="mt-2 text-stone-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

export function LedgerWizard() {
  const { stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

  return (
    <div className="min-h-screen bg-[#f3eee4] text-stone-900">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav className="border-b border-stone-300 px-6 py-8 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Trip brief</p>
          <ol className="mt-6 space-y-1">
            {LAB_WIZARD_SECTIONS.map((section, index) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => goStep(index)}
                  className={`flex w-full items-baseline gap-3 py-2 text-left ${
                    index === stepIndex ? "text-[#016d76]" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <span className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
                  <span className={index === stepIndex ? "border-b border-[#ff5757] pb-0.5" : ""}>
                    {section.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="px-6 py-10 sm:px-12">
          <WizardStepFields skin="ledger" index={stepIndex} />
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-stone-300 pt-6">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => goStep(stepIndex - 1)}
              className="font-mono text-xs uppercase tracking-widest text-stone-500 disabled:opacity-30"
            >
              ← Previous
            </button>
            {last ? (
              <Link
                href={canGenerate ? conceptPath("ledger", "itinerary") : "#"}
                aria-disabled={!canGenerate}
                className={`font-[family-name:var(--font-lab-serif)] text-xl ${canGenerate ? "text-[#c45c4a]" : "pointer-events-none text-stone-400"}`}
              >
                Issue the itinerary →
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => goStep(stepIndex + 1)}
                className="font-[family-name:var(--font-lab-serif)] text-xl text-[#016d76] disabled:text-stone-400"
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LedgerItinerary() {
  const { itinerary, downloadPdf } = useDesignLab();
  const facts = planFacts(DALLAS_PLAN);
  const totals = tripTotals(itinerary);

  return (
    <div className="min-h-screen bg-[#f3eee4] text-stone-900">
      <header className="border-b border-stone-400">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-4 px-6 py-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#016d76]">Family itinerary</p>
            <h1 className="mt-2 font-[family-name:var(--font-lab-serif)] text-4xl">{itinerary.destinationCity}</h1>
            <p className="mt-1 text-stone-600">
              {facts.when} · {facts.party}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs uppercase tracking-widest text-stone-500">Trip total</p>
            <p className="font-[family-name:var(--font-lab-serif)] text-3xl">{moneyWhole(totals.total)}</p>
            <button type="button" onClick={() => void downloadPdf()} className="mt-2 text-sm text-[#016d76] underline">
              Download
            </button>
          </div>
        </div>
        <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-2 border-t border-stone-300 px-6 py-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-stone-500">Stay</dt>
            <dd>{facts.stay}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-stone-500">Transit</dt>
            <dd>{facts.transit}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-stone-500">Pace</dt>
            <dd>{facts.pace}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-stone-500">Nap</dt>
            <dd>{facts.naps}</dd>
          </div>
        </dl>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {itinerary.days.map((day) => (
          <section key={day.date} id={`ledger-day-${day.day}`} className="mb-16 break-inside-avoid">
            <div className="flex items-baseline justify-between border-b-2 border-stone-800 pb-2">
              <h2 className="font-[family-name:var(--font-lab-serif)] text-2xl">
                Day {day.day} · {day.weekday}
              </h2>
              <p className="font-mono text-sm">{day.formattedDate.replace(/^\w+, /, "")}</p>
            </div>
            <p className="mt-3 italic text-stone-600">{dayHeadline(day)}</p>
            <table className="mt-6 w-full text-left">
              <tbody>
                {visibleStops(day).map((activity) => (
                  <tr key={`${activity.time}-${activity.title}`} className="border-b border-stone-300/80 align-top">
                    <td className="w-24 py-3 font-mono text-sm text-[#016d76]">{formatClock(activity.time)}</td>
                    <td className="py-3">
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-stone-500">
                        {activityKindLabel(activity.type)}
                        {activity.location ? ` · ${activity.location.name}` : ""}
                      </p>
                      {activity.notes ? <p className="mt-1 max-w-xl text-sm text-stone-600">{activity.notes}</p> : null}
                    </td>
                    <td className="w-20 py-3 text-right font-mono text-sm">
                      {activity.activityCost ? moneyWhole(activity.activityCost) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {day.routeSegments.length > 0 ? (
              <p className="mt-3 font-mono text-xs text-stone-500">
                Taxis: {day.routeSegments.map((segment) => `${formatMiles(segment.distanceKm)} / ${segment.durationMin}m`).join(" · ")}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-6 border-t border-stone-400 pt-2 font-mono text-xs uppercase tracking-widest">
              <span>Out {moneyWhole(day.costBreakdown.activities)}</span>
              <span>Rides {moneyWhole(day.costBreakdown.transport)}</span>
              <span>Day {moneyWhole(day.costBreakdown.total)}</span>
            </div>
          </section>
        ))}
        <footer className="border-t-2 border-stone-800 pt-4">
          <div className="flex flex-wrap justify-between gap-4 font-mono text-sm">
            <span>Activities {moneyWhole(totals.activities)}</span>
            <span>Transport {moneyWhole(totals.transport)}</span>
            <span>Food {moneyWhole(totals.food)}</span>
            <span className="font-[family-name:var(--font-lab-serif)] text-xl tracking-normal">
              Total {moneyWhole(totals.total)}
            </span>
          </div>
          <p className="mt-3 text-xs text-stone-500">{itinerary.pricingDisclaimer}</p>
        </footer>
      </div>
    </div>
  );
}
