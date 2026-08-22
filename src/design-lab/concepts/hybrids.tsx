"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RouteSketch } from "../components/RouteSketch";
import { conceptPath, type LabConceptId } from "../concepts";
import { DALLAS_PLAN } from "../fixtures/dallas";
import {
  activityKindLabel,
  formatClockCompact,
  mapLocations,
  moneyWhole,
  planFacts,
  tripTotals,
  visibleStops,
} from "../lib/helpers";
import { LAB_WIZARD_SECTIONS } from "../lib/wizard-options";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";

export type HybridId = "harbor" | "route" | "daylight";

type HybridTheme = {
  id: HybridId;
  bg: string;
  ink: string;
  muted: string;
  line: string;
  surface: string;
  teal: string;
  coral: string;
  fontClass: string;
  homeKicker: string;
  homeTitle: string;
  homeBody: string;
  homeCta: string;
  asideKicker: string;
  steps: [string, string, string][];
  wizardLabel: string;
  backLabel: string;
  continueLabel: string;
  generateLabel: string;
  itineraryLayout: "week-first" | "map-always" | "day-first";
};

export const HYBRID_THEMES: Record<HybridId, HybridTheme> = {
  harbor: {
    id: "harbor",
    bg: "bg-[#f7fbfc]",
    ink: "text-[#1f2937]",
    muted: "text-[#6b7280]",
    line: "border-[#d9e8eb]",
    surface: "bg-white",
    teal: "#016d76",
    coral: "#ff5757",
    fontClass: "font-[family-name:var(--font-jakarta)]",
    homeKicker: "Family travel planning",
    homeTitle: "Plan a family trip that actually works",
    homeBody:
      "Personalized day-by-day itineraries built around your kids, your pace, and your budget — without hours of planning.",
    homeCta: "Plan my trip",
    asideKicker: "How it works",
    steps: [
      ["1", "Tell us about your family", "Kids’ ages, stay, pace, food needs, and budget style."],
      ["2", "Get a week you can scan", "See every day at once, then open the one you want to follow."],
      ["3", "Follow the day with a map", "Meals, naps, and outings in order — plus where you’ll actually be."],
    ],
    wizardLabel: "Your trip",
    backLabel: "Back",
    continueLabel: "Continue",
    generateLabel: "See the itinerary",
    itineraryLayout: "week-first",
  },
  route: {
    id: "route",
    bg: "bg-white",
    ink: "text-slate-900",
    muted: "text-slate-500",
    line: "border-slate-200",
    surface: "bg-slate-50",
    teal: "#016d76",
    coral: "#ff5757",
    fontClass: "font-[family-name:var(--font-lab-dm)]",
    homeKicker: "For families with kids",
    homeTitle: "Set the details. See the week on a map.",
    homeBody:
      "We’ll use ages, naps, and how you get around to build a plan you can compare day to day — with the route in view.",
    homeCta: "Start planning",
    asideKicker: "From questions to a route",
    steps: [
      ["1", "Family facts", "Who’s coming, where you’re staying, how you’ll move."],
      ["2", "A board of the trip", "Museum day vs water day, at a glance."],
      ["3", "One day, mapped", "Open a day to follow the stops in order."],
    ],
    wizardLabel: "Plan",
    backLabel: "Back",
    continueLabel: "Next",
    generateLabel: "Open the week",
    itineraryLayout: "map-always",
  },
  daylight: {
    id: "daylight",
    bg: "bg-[#f7fbfc]",
    ink: "text-slate-900",
    muted: "text-slate-500",
    line: "border-[#d9e8eb]",
    surface: "bg-white",
    teal: "#016d76",
    coral: "#ff5757",
    fontClass: "font-[family-name:var(--font-lab-outfit)]",
    homeKicker: "Made for real family days",
    homeTitle: "A week of family days, without the planning slog",
    homeBody:
      "Answer a few questions. Get a board of the trip, a map for each day, and a simple day view when you’re ready to follow it.",
    homeCta: "Let’s plan",
    asideKicker: "What you get",
    steps: [
      ["1", "A short brief", "The details that actually change a day."],
      ["2", "Today, clearly", "Follow one day at a time, the way you already do."],
      ["3", "The rest of the week in reach", "Glance at the other days, and see today’s route on a map."],
    ],
    wizardLabel: "Planning",
    backLabel: "Back",
    continueLabel: "Continue",
    generateLabel: "Show my plan",
    itineraryLayout: "day-first",
  },
};

export function HybridHome({ id }: { id: HybridId }) {
  const theme = HYBRID_THEMES[id];
  return (
    <div className={`min-h-screen ${theme.bg} ${theme.ink} ${theme.fontClass}`}>
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className={`border-b ${theme.line} px-6 py-16 sm:px-12 lg:border-b-0 lg:border-r lg:py-24`}>
          <FamilyTravelyLogo className="h-auto w-48" />
          <p className="mt-10 text-sm font-medium" style={{ color: theme.teal }}>
            {theme.homeKicker}
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {theme.homeTitle}
          </h1>
          <p className={`mt-5 max-w-md text-lg leading-relaxed ${theme.muted}`}>{theme.homeBody}</p>
          <Link
            href={conceptPath(id, "wizard")}
            className="mt-8 inline-flex rounded-full px-6 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: theme.coral }}
          >
            {theme.homeCta}
          </Link>
          <p className={`mt-3 text-sm ${theme.muted}`}>Free to start. No account needed.</p>
        </section>
        <aside className="px-6 py-16 sm:px-12 lg:py-24">
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.muted}`}>{theme.asideKicker}</p>
          <ol className="mt-8 space-y-6">
            {theme.steps.map(([n, title, body]) => (
              <li key={n} className={`grid grid-cols-[2.5rem_1fr] gap-4 border-t ${theme.line} pt-6`}>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: theme.teal }}
                >
                  {n}
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                  <p className={`mt-1 text-sm leading-relaxed ${theme.muted}`}>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

export function HybridWizard({ id }: { id: HybridId }) {
  const theme = HYBRID_THEMES[id];
  const { stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.ink} ${theme.fontClass}`}>
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <nav className={`border-b ${theme.line} px-5 py-8 lg:border-b-0 lg:border-r`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.muted}`}>{theme.wizardLabel}</p>
          <ol className="mt-5 space-y-1">
            {LAB_WIZARD_SECTIONS.map((section, index) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => goStep(index)}
                  className={`flex w-full items-baseline gap-3 rounded-lg px-2 py-2 text-left text-sm ${
                    index === stepIndex ? "font-semibold" : theme.muted
                  }`}
                  style={index === stepIndex ? { color: theme.teal, backgroundColor: "rgba(1,109,118,0.08)" } : undefined}
                >
                  <span className="w-4 text-xs tabular-nums">{index + 1}</span>
                  {section.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="px-6 py-10 sm:px-12">
          <WizardStepFields skin={id} index={stepIndex} />
          <div className={`mt-12 flex flex-wrap items-center justify-between gap-4 border-t ${theme.line} pt-6`}>
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => goStep(stepIndex - 1)}
              className={`text-sm font-medium ${theme.muted} disabled:opacity-30`}
            >
              {theme.backLabel}
            </button>
            {last ? (
              <Link
                href={canGenerate ? conceptPath(id, "itinerary") : "#"}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white ${canGenerate ? "" : "pointer-events-none bg-slate-300"}`}
                style={canGenerate ? { backgroundColor: theme.coral } : undefined}
              >
                {theme.generateLabel}
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => goStep(stepIndex + 1)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
                style={canContinue ? { backgroundColor: theme.teal } : undefined}
              >
                {theme.continueLabel}
              </button>
            )}
          </div>
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

function DayTab({
  day,
  selected,
  onClick,
}: {
  day: ItineraryDay;
  selected: boolean;
  onClick: () => void;
}) {
  const parsed = new Date(`${day.date}T12:00:00`);
  const sub = Number.isNaN(parsed.getTime())
    ? day.weekday.slice(0, 3)
    : `${parsed.getDate()} ${parsed.toLocaleDateString("en-US", { weekday: "short" })}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-left ${
        selected ? "bg-[#016d76] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
      }`}
    >
      <span className="block text-sm font-semibold">Day {day.day}</span>
      <span className={`block text-[11px] ${selected ? "text-white/80" : "text-slate-500"}`}>{sub}</span>
    </button>
  );
}

function BoardColumn({
  day,
  compact,
  active,
  onSelectDay,
}: {
  day: ItineraryDay;
  compact?: boolean;
  active?: boolean;
  onSelectDay?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className={compact ? "w-[11rem] shrink-0" : "w-[min(100%,18rem)] shrink-0 sm:w-72"}>
      <button type="button" onClick={onSelectDay} className="mb-2 w-full text-left">
        <h2 className={`text-sm font-semibold ${active ? "text-[#016d76]" : ""}`}>
          {day.weekday} {day.date.slice(-2)}
          <span className="mt-0.5 block text-xs font-normal text-slate-500">{day.displayTitle}</span>
        </h2>
      </button>
      <div className="space-y-2">
        {visibleStops(day).map((activity) => {
          const key = `${day.day}-${activity.time}-${activity.title}`;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectDay?.();
                setOpen(open === key ? null : key);
              }}
              className={`w-full rounded-md p-3 text-left shadow-sm ${blockTone(activity.type)} ${compact ? "p-2" : ""}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {formatClockCompact(activity.time)} · {activityKindLabel(activity.type)}
              </p>
              <p className={`mt-1 font-medium ${compact ? "text-xs" : "text-sm"}`}>{activity.title}</p>
              {!compact && activity.activityCost ? (
                <p className="mt-1 text-xs text-slate-500">{moneyWhole(activity.activityCost)}</p>
              ) : null}
              {!compact && open === key && activity.notes ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{activity.notes}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SpendBars({ days, max }: { days: ItineraryDay[]; max: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {days.map((day) => (
        <div key={day.date} className="min-w-[6.5rem] flex-1">
          <p className="text-[11px] text-slate-500">
            Day {day.day} · {moneyWhole(day.costBreakdown.total)}
          </p>
          <div className="mt-1 h-2 rounded bg-slate-200">
            <div
              className="h-2 rounded bg-[#016d76]"
              style={{ width: `${Math.max(12, (day.costBreakdown.total / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DayBlocks({
  day,
  onPickStop,
}: {
  day: ItineraryDay;
  onPickStop?: (name: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {visibleStops(day).map((activity) => {
        const key = `${day.day}-${activity.time}-${activity.title}`;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (activity.location) onPickStop?.(activity.location.name);
              setOpen(open === key ? null : key);
            }}
            className={`w-full rounded-md p-3 text-left shadow-sm ${blockTone(activity.type)}`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {formatClockCompact(activity.time)} · {activityKindLabel(activity.type)}
            </p>
            <p className="mt-1 text-sm font-medium">{activity.title}</p>
            {activity.location ? <p className="mt-0.5 text-xs text-slate-500">{activity.location.name}</p> : null}
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
  );
}

export function HybridItinerary({ id }: { id: HybridId }) {
  const theme = HYBRID_THEMES[id];
  const { itinerary, downloadPdf } = useDesignLab();
  const facts = planFacts(DALLAS_PLAN);
  const totals = tripTotals(itinerary);
  const maxDay = Math.max(...itinerary.days.map((day) => day.costBreakdown.total), 1);
  const [view, setView] = useState<"week" | "day">(theme.itineraryLayout === "day-first" ? "day" : "week");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedStop, setSelectedStop] = useState<string | undefined>();
  const day = itinerary.days[dayIndex]!;
  const locations = useMemo(() => mapLocations(day), [day]);

  function selectDay(index: number, nextView?: "week" | "day") {
    setDayIndex(index);
    setSelectedStop(undefined);
    if (nextView) setView(nextView);
  }

  const header = (
    <header className={`sticky top-0 z-10 border-b ${theme.line} ${theme.surface}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">
            {itinerary.destinationCity} · {facts.when}
          </h1>
          <p className={`text-xs ${theme.muted}`}>
            {facts.party} · {facts.stay} · {facts.transit}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Trip total</p>
            <p className="text-xl font-semibold">{moneyWhole(totals.total)}</p>
          </div>
          <button type="button" onClick={() => void downloadPdf()} className="text-sm" style={{ color: theme.teal }}>
            Download
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <SpendBars days={itinerary.days} max={maxDay} />
      </div>
      {theme.itineraryLayout !== "day-first" ? (
        <div className="flex gap-2 px-4 pb-3">
          {(["week", "day"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                view === mode ? "bg-[#016d76] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {mode === "week" ? "Week" : "Day"}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );

  if (theme.itineraryLayout === "map-always") {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.ink} ${theme.fontClass}`}>
        {header}
        <div className="flex min-h-0 flex-col lg:flex-row">
          <div className="relative min-h-[14rem] lg:w-[42%] lg:min-h-[calc(100vh-11rem)]">
            <RouteSketch locations={locations} selected={selectedStop} onSelect={setSelectedStop} height={420} />
            <p className="absolute bottom-3 left-3 rounded bg-white/95 px-2 py-1 text-xs text-slate-600">
              {day.displayTitle} · {moneyWhole(day.costBreakdown.total)}
            </p>
          </div>
          <div className="min-w-0 flex-1 p-4">
            {view === "week" ? (
              <div className="flex gap-3 overflow-x-auto">
                {itinerary.days.map((item, index) => (
                  <div
                    key={item.date}
                    className={index === dayIndex ? "rounded-lg ring-2 ring-[#016d76] ring-offset-2" : ""}
                  >
                    <BoardColumn day={item} onSelectDay={() => selectDay(index)} active={index === dayIndex} />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {itinerary.days.map((item, index) => (
                    <DayTab key={item.date} day={item} selected={index === dayIndex} onClick={() => selectDay(index)} />
                  ))}
                </div>
                <p className={`mb-3 text-sm ${theme.muted}`}>{day.displayTitle}</p>
                <DayBlocks day={day} onPickStop={setSelectedStop} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (theme.itineraryLayout === "day-first") {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.ink} ${theme.fontClass}`}>
        {header}
        <div className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {itinerary.days.map((item, index) => (
              <DayTab key={item.date} day={item} selected={index === dayIndex} onClick={() => selectDay(index, "day")} />
            ))}
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">The week</p>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {itinerary.days.map((item, index) => (
              <div
                key={item.date}
                className={index === dayIndex ? "rounded-lg ring-2 ring-[#016d76] ring-offset-2" : "opacity-80"}
              >
                <BoardColumn day={item} compact onSelectDay={() => selectDay(index, "day")} active={index === dayIndex} />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
            <RouteSketch locations={locations} selected={selectedStop} onSelect={setSelectedStop} height={220} />
          </div>
          <div className="mt-2 flex justify-between text-sm text-slate-500">
            <span>{day.displayTitle}</span>
            <span>Today · {moneyWhole(day.costBreakdown.total)}</span>
          </div>
        </div>
        <div className="px-4 pb-10">
          <DayBlocks day={day} onPickStop={setSelectedStop} />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.ink} ${theme.fontClass}`}>
      {header}
      {view === "week" ? (
        <div className="flex gap-3 overflow-x-auto p-4">
          {itinerary.days.map((item, index) => (
            <BoardColumn
              key={item.date}
              day={item}
              onSelectDay={() => selectDay(index, "day")}
              active={index === dayIndex}
            />
          ))}
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {itinerary.days.map((item, index) => (
              <DayTab key={item.date} day={item} selected={index === dayIndex} onClick={() => selectDay(index)} />
            ))}
          </div>
          <div className="mb-4 overflow-hidden rounded-xl ring-1 ring-slate-200">
            <RouteSketch locations={locations} selected={selectedStop} onSelect={setSelectedStop} height={240} />
          </div>
          <p className={`mb-3 text-sm ${theme.muted}`}>{day.displayTitle}</p>
          <div className="max-w-xl">
            <DayBlocks day={day} onPickStop={setSelectedStop} />
          </div>
        </div>
      )}
    </div>
  );
}

export function isHybridId(id: LabConceptId): id is HybridId {
  return id === "harbor" || id === "route" || id === "daylight";
}
