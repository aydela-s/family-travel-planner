"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RouteSketch } from "../components/RouteSketch";
import { conceptPath, type LabConceptId } from "../concepts";
import { DALLAS_PLAN } from "../fixtures/dallas";
import { mapLocations, moneyWhole, planFacts, tripTotals } from "../lib/helpers";
import { LAB_WIZARD_SECTIONS } from "../lib/wizard-options";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";
import { HarborHome as HarborHomeScreen } from "./harbor-home";
import { HarborItinerary as HarborItineraryScreen } from "./harbor-itinerary";
import { HarborWizard as HarborWizardScreen } from "./harbor-wizard";
import { BoardBlocks, DayTabs, SpendBars, WeekColumns } from "./parts";

type MixId = "harbor" | "route" | "daylight";

const MIX_THEME: Record<
  MixId,
  {
    page: string;
    nav: string;
    navLabel: string;
    active: string;
    underline: string;
    continue: string;
    generate: string;
    generateLabel: string;
    continueLabel: string;
    backLabel: string;
    asideLabel: string;
  }
> = {
  harbor: {
    page: "min-h-screen bg-[#f7fbfc] text-slate-900",
    nav: "border-[#d9e8eb] bg-white",
    navLabel: "Your trip",
    active: "text-[#016d76]",
    underline: "border-[#ff5757]",
    continue: "rounded-full bg-[#016d76] px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300",
    generate: "rounded-full bg-[#ff5757] px-5 py-2.5 text-sm font-semibold text-white",
    generateLabel: "Generate itinerary",
    continueLabel: "Continue",
    backLabel: "Back",
    asideLabel: "How it works",
  },
  route: {
    page: "min-h-screen bg-white text-slate-900",
    nav: "border-slate-200 bg-slate-50",
    navLabel: "Plan",
    active: "text-[#016d76]",
    underline: "border-[#02bbcb]",
    continue: "rounded-md bg-[#016d76] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300",
    generate: "rounded-md bg-[#016d76] px-4 py-2 text-sm font-semibold text-white",
    generateLabel: "See the route",
    continueLabel: "Next",
    backLabel: "Back",
    asideLabel: "What you get",
  },
  daylight: {
    page: "min-h-screen bg-[#fff8f6] text-slate-900",
    nav: "border-[#f3d5d2] bg-white",
    navLabel: "Steps",
    active: "text-[#c45c4a]",
    underline: "border-[#ff5757]",
    continue: "rounded-full bg-[#016d76] px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300",
    generate: "rounded-full bg-[#ff5757] px-5 py-2.5 text-sm font-semibold text-white",
    generateLabel: "See the plan",
    continueLabel: "Continue",
    backLabel: "Back",
    asideLabel: "Why this works",
  },
};

function MixHome({
  id,
  headline,
  body,
  cta,
  steps,
}: {
  id: MixId;
  headline: string;
  body: string;
  cta: string;
  steps: [string, string, string][];
}) {
  const theme = MIX_THEME[id];
  return (
    <div className={theme.page}>
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section
          className={`border-b px-6 py-16 sm:px-12 lg:border-b-0 lg:border-r lg:py-24 ${id === "daylight" ? "border-[#f3d5d2]" : "border-[#d9e8eb]"}`}
        >
          <FamilyTravelyLogo className="h-auto w-48" />
          <h1 className="mt-10 max-w-xl text-4xl font-semibold tracking-tight text-[#016d76] sm:text-5xl">
            {headline}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-600">{body}</p>
          <Link
            href={conceptPath(id, "wizard")}
            className={
              id === "route"
                ? "mt-8 inline-flex rounded-md bg-[#016d76] px-5 py-3 text-sm font-semibold text-white"
                : "mt-8 inline-flex rounded-full bg-[#ff5757] px-6 py-3 text-sm font-semibold text-white"
            }
          >
            {cta}
          </Link>
          <p className="mt-3 text-sm text-slate-500">Free to start. No account needed.</p>
        </section>
        <aside className="px-6 py-16 sm:px-12 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{theme.asideLabel}</p>
          <ol className="mt-8 space-y-8">
            {steps.map(([n, title, copy]) => (
              <li
                key={n}
                className={`grid grid-cols-[3rem_1fr] gap-4 border-t pt-6 ${id === "daylight" ? "border-[#f3d5d2]" : "border-[#d9e8eb]"}`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#016d76] text-sm font-semibold text-white">
                  {n}
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                  <p className="mt-2 text-slate-600">{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function MixWizard({ id }: { id: MixId }) {
  const { stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;
  const theme = MIX_THEME[id];

  return (
    <div className={theme.page}>
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav className={`border-b px-6 py-8 lg:border-b-0 lg:border-r ${theme.nav}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{theme.navLabel}</p>
          <ol className="mt-6 space-y-1">
            {LAB_WIZARD_SECTIONS.map((section, index) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => goStep(index)}
                  className={`flex w-full items-baseline gap-3 py-2 text-left ${
                    index === stepIndex ? theme.active : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-5 text-xs font-semibold">{index + 1}</span>
                  <span className={index === stepIndex ? `border-b pb-0.5 ${theme.underline}` : ""}>
                    {section.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="px-6 py-10 sm:px-12">
          <WizardStepFields skin={id} index={stepIndex} />
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#d9e8eb] pt-6">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => goStep(stepIndex - 1)}
              className="text-sm font-medium text-slate-500 disabled:opacity-30"
            >
              {theme.backLabel}
            </button>
            {last ? (
              <Link
                href={canGenerate ? conceptPath(id, "itinerary") : "#"}
                className={`${theme.generate} ${canGenerate ? "" : "pointer-events-none opacity-40"}`}
              >
                {theme.generateLabel}
              </Link>
            ) : (
              <button type="button" disabled={!canContinue} onClick={() => goStep(stepIndex + 1)} className={theme.continue}>
                {theme.continueLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HarborHome() {
  return <HarborHomeScreen />;
}

export function HarborWizard() {
  return <HarborWizardScreen />;
}

export function HarborItinerary() {
  return <HarborItineraryScreen />;
}

export function RouteHome() {
  return (
    <MixHome
      id="route"
      headline="See where the day actually goes"
      body="Set up the trip, then follow Dallas on a map — with a week board you can open one day at a time."
      cta="Start planning"
      steps={[
        ["1", "Answer a short brief", "Destination, who is coming, stay, pace, and interests."],
        ["2", "Compare the week", "Spot the long taxi day before you commit."],
        ["3", "Follow today on the map", "Open a day to see stops, timing, and the route."],
      ]}
    />
  );
}

export function RouteWizard() {
  return <MixWizard id="route" />;
}

export function RouteItinerary() {
  return <MixItinerary variant="route" />;
}

export function DaylightHome() {
  return (
    <MixHome
      id="daylight"
      headline="A plan your family can keep"
      body="Start with today, the way you already use the itinerary — and still see the rest of the week and where you’ll be."
      cta="Plan this trip"
      steps={[
        ["1", "A few family details", "The same questions, in a clearer order."],
        ["2", "Today first", "Day tabs like the current itinerary, with board-style stops."],
        ["3", "The week and the map", "A compact week strip plus today’s route, always nearby."],
      ]}
    />
  );
}

export function DaylightWizard() {
  return <MixWizard id="daylight" />;
}

export function DaylightItinerary() {
  return <MixItinerary variant="daylight" />;
}

function MixItinerary({ variant }: { variant: MixId }) {
  const { itinerary, downloadPdf } = useDesignLab();
  const facts = planFacts(DALLAS_PLAN);
  const totals = tripTotals(itinerary);
  const [mode, setMode] = useState<"week" | "day">(variant === "harbor" ? "week" : "day");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedStop, setSelectedStop] = useState<string | undefined>(undefined);
  const day = itinerary.days[dayIndex]!;
  const locations = useMemo(() => mapLocations(day), [day]);

  function selectDay(index: number) {
    setDayIndex(index);
    setSelectedStop(undefined);
    if (variant === "harbor") setMode("day");
  }

  const page =
    variant === "daylight" ? "min-h-screen bg-[#fff8f6] text-slate-900" : "min-h-screen bg-slate-100 text-slate-900";

  const header = (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">
            {itinerary.destinationCity} · {facts.when}
          </h1>
          <p className="text-xs text-slate-500">
            {facts.party} · {facts.stay} · {facts.transit}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {variant === "harbor" ? (
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode("week")}
                className={`rounded-full px-3 py-1 ${mode === "week" ? "bg-[#016d76] text-white" : "text-slate-600"}`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setMode("day")}
                className={`rounded-full px-3 py-1 ${mode === "day" ? "bg-[#016d76] text-white" : "text-slate-600"}`}
              >
                Day
              </button>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Trip total</p>
            <p className="text-xl font-semibold">{moneyWhole(totals.total)}</p>
          </div>
          <button type="button" onClick={() => void downloadPdf()} className="text-sm text-[#016d76]">
            Download
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <SpendBars days={itinerary.days} />
      </div>
    </header>
  );

  if (variant === "harbor") {
    return (
      <div className={page}>
        {header}
        {mode === "week" ? (
          <div className="p-4">
            <p className="mb-3 text-sm text-slate-500">Tap a day to open it with the map.</p>
            <WeekColumns days={itinerary.days} onSelect={selectDay} />
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <DayTabs days={itinerary.days} selected={dayIndex} onSelect={selectDay} />
            <p className="text-sm text-slate-500">{day.displayTitle}</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <RouteSketch locations={locations} selected={selectedStop} onSelect={setSelectedStop} height={240} />
            </div>
            <div className="mx-auto max-w-md">
              <BoardBlocks day={day} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "route") {
    return (
      <div className="flex min-h-screen flex-col bg-white text-slate-900 lg:h-[calc(100vh-7rem)] lg:flex-row lg:overflow-hidden">
        <section className="relative min-h-[36vh] lg:min-h-0 lg:w-[46%]">
          <RouteSketch locations={locations} selected={selectedStop} onSelect={setSelectedStop} height={520} />
          <div className="absolute left-4 top-4 rounded-md bg-white/95 px-3 py-2 text-sm shadow-sm">
            <p className="font-semibold text-[#016d76]">{itinerary.destinationCity}</p>
            <p className="text-xs text-slate-500">{day.displayTitle}</p>
          </div>
        </section>
        <section className="flex min-h-0 flex-1 flex-col border-t border-slate-200 lg:border-l lg:border-t-0">
          {header}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <DayTabs days={itinerary.days} selected={dayIndex} onSelect={selectDay} />
            <p className="text-sm text-slate-500">
              {day.weekday}: {day.displayTitle} · {moneyWhole(day.costBreakdown.total)}
            </p>
            <WeekColumns days={itinerary.days} selected={dayIndex} onSelect={selectDay} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={page}>
      {header}
      <div className="space-y-4 p-4">
        <DayTabs days={itinerary.days} selected={dayIndex} onSelect={selectDay} />
        <p className="text-sm font-medium text-slate-700">{day.displayTitle}</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,22rem)]">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <RouteSketch locations={locations} selected={selectedStop} onSelect={setSelectedStop} height={280} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today · {moneyWhole(day.costBreakdown.total)}
            </p>
            <BoardBlocks day={day} />
          </div>
        </div>
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#016d76]">See the week</summary>
          <div className="mt-4">
            <WeekColumns days={itinerary.days} selected={dayIndex} onSelect={selectDay} />
          </div>
        </details>
      </div>
    </div>
  );
}

export function isMixId(id: LabConceptId): id is MixId {
  return id === "harbor" || id === "route" || id === "daylight";
}
