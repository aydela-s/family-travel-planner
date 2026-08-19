"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import { conceptPath } from "../concepts";
import { DALLAS_PLAN } from "../fixtures/dallas";
import { formatClock, moneyWhole, planFacts, tripTotals, visibleStops } from "../lib/helpers";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";

const COVER: Record<string, string> = {
  "Perot Museum of Nature and Science": "from-[#016d76] to-[#02bbcb]",
  "We Rock the Spectrum": "from-[#c45c4a] to-[#ff8a7a]",
  "Heights Family Aquatic Center": "from-[#02bbcb] to-[#7edce6]",
  "Grapevine Mills": "from-[#3d5a5c] to-[#016d76]",
  "Takeoff Adventure Park": "from-[#ff5757] to-[#c45c4a]",
};

export function JournalHome() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <FamilyTravelyLogo className="h-auto w-40" />
        <Link href={conceptPath("journal", "wizard")} className="text-sm tracking-wide text-[#016d76]">
          Start a chapter
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-10 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[#c45c4a]">Volume one · Family travel</p>
        <h1 className="mt-6 font-[family-name:var(--font-lab-news)] text-5xl leading-[1.12] sm:text-7xl">
          Days that read as a story, not a dashboard.
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-stone-600">
          A plan you could send to grandparents: what the morning is for, when everyone comes home, and why the afternoon is quieter.
        </p>
        <Link
          href={conceptPath("journal", "wizard")}
          className="mt-10 inline-block bg-stone-900 px-8 py-3 text-sm uppercase tracking-[0.2em] text-[#faf7f2]"
        >
          Write the brief
        </Link>
      </article>
      <div className="mx-auto grid max-w-5xl gap-px bg-stone-200 sm:grid-cols-3">
        {[
          ["Naps as pull quotes", "Rest isn’t a gray row. It’s the sentence the day turns on."],
          ["One thesis per day", "Museum morning. Water day. Long taxi, early night."],
          ["Spend in the colophon", "Figures at the end of the chapter, not a banner up top."],
        ].map(([title, body]) => (
          <section key={title} className="bg-[#faf7f2] px-8 py-10 text-left">
            <h2 className="font-[family-name:var(--font-lab-news)] text-2xl">{title}</h2>
            <p className="mt-3 text-stone-600">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function JournalWizard() {
  const { stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12 sm:py-20">
        <p className="text-center text-xs tracking-[0.3em] text-stone-400">
          {stepIndex + 1} of {WIZARD_STEP_TITLES.length}
        </p>
        <div className="mt-12 flex-1">
          <WizardStepFields skin="journal" index={stepIndex} />
        </div>
        <div className="mt-16 flex items-center justify-between border-t border-stone-200 pt-8">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => goStep(stepIndex - 1)}
            className="text-sm tracking-wide text-stone-500 disabled:opacity-30"
          >
            Previous chapter
          </button>
          {last ? (
            <Link
              href={canGenerate ? conceptPath("journal", "itinerary") : "#"}
              className={`text-sm uppercase tracking-[0.18em] ${canGenerate ? "text-[#c45c4a]" : "pointer-events-none text-stone-300"}`}
            >
              Open the journal
            </Link>
          ) : (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => goStep(stepIndex + 1)}
              className="text-sm uppercase tracking-[0.18em] text-[#016d76] disabled:text-stone-300"
            >
              Next chapter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function JournalItinerary() {
  const { itinerary, downloadPdf } = useDesignLab();
  const facts = planFacts(DALLAS_PLAN);
  const totals = tripTotals(itinerary);

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900">
      <header className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[#016d76]">A Dallas family journal</p>
        <h1 className="mt-4 font-[family-name:var(--font-lab-news)] text-5xl sm:text-6xl">{itinerary.destinationCity}</h1>
        <p className="mt-4 text-stone-600">
          {facts.when}
          <br />
          {facts.party} · {facts.stay}
        </p>
        <button type="button" onClick={() => void downloadPdf()} className="mt-6 text-sm tracking-wide text-[#c45c4a]">
          Save as PDF
        </button>
      </header>

      {itinerary.days.map((day) => {
        const hero = visibleStops(day).find((item) => item.type === "activity");
        const cover = hero ? COVER[hero.title] ?? "from-[#016d76] to-[#3d5a5c]" : "from-[#016d76] to-[#3d5a5c]";
        const nap = visibleStops(day).find((item) => item.type === "nap");
        return (
          <article key={day.date} className="mx-auto max-w-3xl px-6 pb-20">
            <div className={`flex h-56 items-end bg-gradient-to-br ${cover} px-8 py-6 text-white`}>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] opacity-80">
                  Day {day.day} · {day.weekday}
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-lab-news)] text-3xl leading-tight">
                  {day.displayTitle}
                </h2>
              </div>
            </div>
            {nap ? (
              <blockquote className="border-l-2 border-[#c45c4a] px-6 py-5 font-[family-name:var(--font-lab-news)] text-2xl italic text-stone-700">
                Home at {formatClock(nap.time)} for the nap. Everything else yields to that.
              </blockquote>
            ) : null}
            <div className="mt-8 space-y-8">
              {visibleStops(day).map((activity) =>
                activity.type === "nap" ? null : activity.type === "meal" ? (
                  <aside key={`${activity.time}-meal`} className="ml-auto max-w-sm text-right text-sm text-stone-500">
                    <p className="uppercase tracking-[0.18em] text-[#c45c4a]">Table</p>
                    <p className="mt-1 text-base text-stone-800">
                      {formatClock(activity.time)} — {activity.title}
                    </p>
                  </aside>
                ) : (
                  <section key={`${activity.time}-${activity.title}`}>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#016d76]">{formatClock(activity.time)}</p>
                    <h3 className="mt-1 font-[family-name:var(--font-lab-news)] text-2xl">{activity.title}</h3>
                    {activity.notes ? <p className="mt-2 leading-relaxed text-stone-600">{activity.notes}</p> : null}
                    {activity.activityCost ? (
                      <p className="mt-2 text-sm text-stone-400">{moneyWhole(activity.activityCost)}</p>
                    ) : null}
                  </section>
                ),
              )}
            </div>
            <p className="mt-10 text-center text-xs uppercase tracking-[0.2em] text-stone-400">
              Day colophon · {moneyWhole(day.costBreakdown.total)}
            </p>
          </article>
        );
      })}

      <footer className="mx-auto max-w-3xl border-t border-stone-200 px-6 py-12 text-center text-sm text-stone-500">
        <p>
          Trip colophon · {moneyWhole(totals.total)} · outings {moneyWhole(totals.activities)} · rides{" "}
          {moneyWhole(totals.transport)}
        </p>
        <p className="mt-2 text-xs">{itinerary.pricingDisclaimer}</p>
      </footer>
    </div>
  );
}
