"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RouteSketch } from "../components/RouteSketch";
import { conceptPath } from "../concepts";
import { DALLAS_PLAN, DALLAS_STAY } from "../fixtures/dallas";
import {
  formatClockCompact,
  mapLocations,
  moneyWhole,
  planFacts,
  tripTotals,
  visibleStops,
} from "../lib/helpers";
import { useDesignLab } from "../state";
import { WizardStepFields } from "../wizard/fields";

const ATLAS_PREVIEW_STOPS = [
  { name: "Perot Museum", lat: 32.7868, lng: -96.8063 },
  { name: "Heights Aquatic", lat: 32.8072, lng: -96.8271 },
  { name: "Grapevine Mills", lat: 32.9687, lng: -97.0423 },
];

export function AtlasHome() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="relative min-h-[100svh]">
        <div className="absolute inset-0">
          <RouteSketch locations={[DALLAS_STAY, ...ATLAS_PREVIEW_STOPS]} height={800} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/20" />
        <div className="relative flex min-h-[100svh] max-w-xl flex-col justify-center px-6 py-16 sm:px-12">
          <FamilyTravelyLogo variant="mark" className="h-10 w-auto" />
          <p className="mt-8 text-sm font-medium uppercase tracking-[0.18em] text-[#016d76]">Family atlas</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Plan the city as a route, not a list of cards.
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate-600">
            See where nap-at-home sits on the map. Judge taxi hops before you commit to a second stop.
          </p>
          <Link
            href={conceptPath("atlas", "wizard")}
            className="mt-8 inline-flex w-fit items-center rounded-md bg-[#016d76] px-5 py-3 text-sm font-semibold text-white"
          >
            Set the route
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AtlasWizard() {
  const { stepIndex, goStep, canContinue, canGenerate } = useDesignLab();
  const last = stepIndex === WIZARD_STEP_TITLES.length - 1;

  return (
    <div className="relative min-h-screen bg-[#eef6f7]">
      <div className="absolute inset-0 hidden lg:block">
        <RouteSketch locations={[DALLAS_STAY, ...ATLAS_PREVIEW_STOPS]} height={900} />
      </div>
      <div className="relative flex min-h-screen items-stretch lg:justify-start">
        <div className="w-full max-w-md bg-white shadow-xl lg:min-h-screen">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <FamilyTravelyLogo variant="mark" className="h-8 w-auto" />
            <p className="text-xs font-medium text-slate-500">
              {stepIndex + 1} / {WIZARD_STEP_TITLES.length}
            </p>
          </div>
          <div className="h-1 bg-slate-100">
            <div className="h-full bg-[#02bbcb]" style={{ width: `${((stepIndex + 1) / 6) * 100}%` }} />
          </div>
          <div className="px-5 py-6">
            <WizardStepFields skin="atlas" index={stepIndex} />
          </div>
          <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white px-5 py-4">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => goStep(stepIndex - 1)}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-30"
            >
              Back
            </button>
            {last ? (
              <Link
                href={canGenerate ? conceptPath("atlas", "itinerary") : "#"}
                className={`ml-auto rounded-md px-4 py-2 text-sm font-semibold text-white ${canGenerate ? "bg-[#ff5757]" : "pointer-events-none bg-slate-300"}`}
              >
                See the map
              </Link>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => goStep(stepIndex + 1)}
                className="ml-auto rounded-md bg-[#016d76] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AtlasItinerary() {
  const { itinerary, downloadPdf } = useDesignLab();
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const day = itinerary.days[dayIndex]!;
  const locations = useMemo(() => mapLocations(day), [day]);
  const facts = planFacts(DALLAS_PLAN);
  const totals = tripTotals(itinerary);

  return (
    <div className="flex min-h-screen flex-col bg-white lg:h-screen lg:flex-row lg:overflow-hidden">
      <section className="relative min-h-[42vh] lg:min-h-0 lg:w-[54%]">
        <RouteSketch locations={locations} selected={selected} onSelect={setSelected} height={520} />
        <div className="absolute left-4 top-4 rounded-md bg-white/95 px-3 py-2 text-sm shadow-sm">
          <p className="font-semibold text-[#016d76]">{itinerary.destinationCity}</p>
          <p className="text-xs text-slate-500">{facts.when}</p>
        </div>
        <div className="absolute bottom-4 left-4 rounded-md bg-white/95 px-3 py-2 text-sm shadow-sm">
          <p className="text-xs text-slate-500">Trip estimate</p>
          <p className="font-semibold">{moneyWhole(totals.total)}</p>
        </div>
      </section>
      <section className="flex min-h-0 flex-1 flex-col border-t border-slate-200 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Dallas route</h1>
          <button type="button" onClick={() => void downloadPdf()} className="text-sm text-[#016d76]">
            Download
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {itinerary.days.map((item, index) => (
            <button
              key={item.date}
              type="button"
              onClick={() => {
                setDayIndex(index);
                setSelected(undefined);
              }}
              className={`shrink-0 rounded-md px-3 py-2 text-left text-sm ${
                index === dayIndex ? "bg-[#016d76] text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              <span className="block text-[11px] opacity-80">{item.weekday.slice(0, 3)}</span>
              Day {item.day}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <p className="mb-3 text-sm text-slate-500">{day.displayTitle}</p>
          <ol className="space-y-2">
            {visibleStops(day).map((activity) => {
              const active = selected === activity.location?.name;
              return (
                <li key={`${activity.time}-${activity.title}`}>
                  <button
                    type="button"
                    onClick={() => activity.location && setSelected(activity.location.name)}
                    className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left ${
                      active ? "bg-[#ffecec]" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-[#016d76]">
                      {formatClockCompact(activity.time)}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{activity.title}</span>
                      <span className="block text-xs text-slate-500">{activity.location?.name}</span>
                    </span>
                    {activity.activityCost ? (
                      <span className="text-xs font-medium">{moneyWhole(activity.activityCost)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-sm text-slate-500">
            Day {moneyWhole(day.costBreakdown.total)} · taxis {moneyWhole(day.costBreakdown.transport)}
          </p>
        </div>
      </section>
    </div>
  );
}
