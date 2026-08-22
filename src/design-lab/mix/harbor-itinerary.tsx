"use client";

import PlanSelectionChips from "@/components/PlanSelectionChips";
import ShareItineraryControls from "@/components/ShareItineraryControls";
import { formatAdultsLabel, formatKidsWithAges } from "@/lib/format";
import { formatCoverDateRange } from "@/lib/itinerary-export";
import { namesMatch } from "@/lib/pricing/transport-planner";
import { stayHomeLocation } from "@/lib/planning-engine/stay-home";
import { formatMiles } from "@/lib/format-distance";
import { getTransportationLabel } from "@/lib/format-labels";
import type { ActivityLocation, ItineraryActivity, ItineraryDay, RouteSegment } from "@/types/itinerary";
import type { TransportationType, TripPlan } from "@/types/trip-plan";
import { useMemo, useState } from "react";
import { DayRouteMap } from "../components/DayRouteMap";
import { DALLAS_PLAN } from "../fixtures/dallas";
import { useHarborSkin } from "../harbor-skin";
import { mapLocations, moneyWhole, tripTotals } from "../lib/helpers";
import { useDesignLab } from "../state";
import { HarborSlot, WeekColumns } from "./parts";

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 21s7-4.8 7-10.5a7 7 0 1 0-14 0C5 16.2 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function BudgetWalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-secondary" fill="none" aria-hidden>
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

function travelModeLabel(type: TransportationType | "" | undefined): string {
  if (type === "car-rental") return "Drive";
  if (type === "taxis") return "Taxi";
  if (type === "public-transportation") return "Public transit";
  if (type === "walking") return "Walk";
  return type ? getTransportationLabel(type) : "Travel";
}

function mapsTravelMode(type: TransportationType | "" | undefined): string {
  if (type === "walking") return "walking";
  if (type === "public-transportation") return "transit";
  return "driving";
}

function directionsUrl(
  from: ActivityLocation,
  to: ActivityLocation,
  transportationType: TransportationType | "" | undefined,
  city?: string,
): string {
  const travelmode = mapsTravelMode(transportationType);
  const named = (location: ActivityLocation) =>
    city && !location.name.toLowerCase().includes(city.toLowerCase())
      ? `${location.name}, ${city}`
      : location.name;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(named(from))}&destination=${encodeURIComponent(named(to))}&travelmode=${travelmode}`;
}

function findHopSegment(segments: RouteSegment[], fromName: string, toName: string) {
  return segments.find(
    (s) =>
      namesMatch(s.from, fromName) &&
      namesMatch(s.to, toName) &&
      (s.distanceKm > 0 || s.cost > 0 || s.durationMin > 0),
  );
}

function nearestLocated(activities: ItineraryActivity[], fromIndex: number, direction: -1 | 1): ActivityLocation | null {
  for (let i = fromIndex + direction; i >= 0 && i < activities.length; i += direction) {
    const activity = activities[i]!;
    if (activity.type === "travel") continue;
    if (activity.location) return activity.location;
  }
  return null;
}

function TravelLeg({
  currencySymbol,
  transportationType,
  from,
  to,
  segment,
  activity,
  city,
}: {
  currencySymbol: string;
  transportationType?: TransportationType | "";
  from: ActivityLocation | null;
  to: ActivityLocation | null;
  segment?: RouteSegment;
  activity?: ItineraryActivity;
  city?: string;
}) {
  const miles =
    segment && segment.distanceKm > 0
      ? formatMiles(segment.distanceKm)
      : (activity?.notes?.match(/[\d.]+ mi/)?.[0] ?? null);
  const duration =
    segment && segment.durationMin > 0
      ? `~${segment.durationMin} min`
      : (activity?.notes?.match(/~\d+\s*min/)?.[0] ?? null);
  const costAmount = activity?.activityCost ?? segment?.cost ?? null;
  const cost = costAmount != null && costAmount > 0 ? moneyWhole(costAmount, currencySymbol) : null;
  const maps = from && to ? directionsUrl(from, to, transportationType, city) : null;
  const meta = [miles, duration, cost].filter(Boolean).join(" · ");

  return (
    <div className="relative flex gap-3 border-b border-border/60 px-3 py-2.5 sm:px-4">
      <div className="flex w-7 shrink-0 flex-col items-center self-stretch" aria-hidden>
        <span className="w-px flex-1 border-l border-dashed border-muted/50" />
        <span className="my-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
        <span className="w-px flex-1 border-l border-dashed border-muted/50" />
      </div>
      <div className="min-w-0 flex-1 py-0.5 text-sm leading-relaxed text-muted">
        <p className="font-semibold not-italic text-ink">{travelModeLabel(transportationType)}</p>
        {meta ? <p className="italic [font-synthesis:style]">{meta}</p> : null}
        {maps ? (
          <p>
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="not-italic font-medium text-primary underline-offset-2 hover:underline"
            >
              Open directions in Google Maps
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CurrentStyleHeader({
  itinerary,
  plan,
  totals,
}: {
  itinerary: ReturnType<typeof useDesignLab>["itinerary"];
  plan: TripPlan;
  totals: { total: number; activities: number; food: number; transport: number };
}) {
  const { updatePlan, goStep } = useDesignLab();
  const signals = useHarborSkin() === "signals";
  const symbol = itinerary.currencySymbol;
  const party = [
    plan.startDate && plan.endDate
      ? formatCoverDateRange(plan.startDate, plan.endDate) || itinerary.tripStartFormatted
      : itinerary.tripStartFormatted,
    formatAdultsLabel(plan.adults),
    formatKidsWithAges(plan.children) || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              <PinIcon />
              <span>{itinerary.destinationCity || itinerary.destination}</span>
            </h2>
            <p className="mt-2 text-base text-muted sm:text-lg">{party}</p>
          </div>
          <div className="shrink-0">
            <ShareItineraryControls
              itinerary={itinerary}
              plan={plan}
              buttonClassName={
                signals
                  ? "inline-flex items-center gap-1.5 rounded-full border border-primary/45 bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-[var(--shadow-soft)] transition hover:bg-secondary-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                  : undefined
              }
            />
          </div>
        </div>
        <PlanSelectionChips
          plan={plan}
          onApplyUpdate={updatePlan}
          onEditInWizard={(step, updates) => {
            if (updates) updatePlan(updates);
            goStep(step);
          }}
        />
      </header>

      <section
        className={`rounded-3xl border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6 ${
          signals ? "border-border" : "border-secondary/20"
        }`}
      >
        <header className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-muted">
              <BudgetWalletIcon />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Estimated trip total</p>
              <p
                className={`mt-0.5 text-3xl font-bold tabular-nums tracking-tight ${
                  signals ? "text-ink" : "text-primary"
                }`}
              >
                {moneyWhole(totals.total, symbol)}
              </p>
            </div>
          </div>
        </header>
        <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              label: "Activities",
              amount: totals.activities,
              wrap: signals ? "border-border bg-background" : "border-primary/20 bg-primary-muted/70",
              dot: "bg-itinerary-activity",
            },
            {
              label: "Food",
              amount: totals.food,
              wrap: signals ? "border-border bg-background" : "border-accent/25 bg-accent-muted/80",
              dot: "bg-itinerary-meal",
            },
            {
              label: "Transport",
              amount: totals.transport,
              wrap: signals ? "border-border bg-background" : "border-secondary/30 bg-secondary-muted",
              dot: "bg-itinerary-rest",
            },
          ].map((segment) => (
            <div key={segment.label} className={`min-w-0 rounded-2xl border px-2.5 py-3 text-center sm:px-3.5 sm:text-left ${segment.wrap}`}>
              <dt className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink/70 sm:justify-start">
                <span className={`h-2 w-2 rounded-full ${segment.dot}`} aria-hidden />
                {segment.label}
              </dt>
              <dd className="mt-1.5 text-base font-bold tabular-nums text-ink sm:text-lg">
                {moneyWhole(segment.amount, symbol)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">{itinerary.pricingDisclaimer}</p>
      </section>
    </div>
  );
}

function CurrentDayTabs({
  days,
  selected,
  onSelect,
}: {
  days: ItineraryDay[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const signals = useHarborSkin() === "signals";
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Trip days">
      {days.map((day, index) => {
        const parsed = new Date(`${day.date}T12:00:00`);
        const sub = Number.isNaN(parsed.getTime())
          ? day.weekday.slice(0, 3)
          : `${parsed.getDate()} ${parsed.toLocaleDateString("en-US", { weekday: "short" })}`;
        const active = index === selected;
        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(index)}
            className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border text-center transition sm:h-[4.75rem] sm:w-[4.75rem] ${
              active
                ? "border-primary bg-primary text-white shadow-soft"
                : signals
                  ? "border-border bg-surface text-ink hover:bg-secondary-muted"
                  : "border-secondary/35 bg-secondary-muted/40 text-ink hover:border-secondary hover:bg-secondary-muted"
            }`}
          >
            <span className="text-xs font-semibold sm:text-sm">Day {day.day}</span>
            <span className={`text-[10px] sm:text-xs ${active ? "text-white/85" : "text-muted"}`}>{sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function HarborDayTimeline({
  day,
  plan,
  currencySymbol,
  city,
  onFocusStop,
}: {
  day: ItineraryDay;
  plan: TripPlan;
  currencySymbol: string;
  city?: string;
  onFocusStop?: (name?: string) => void;
}) {
  const stay = stayHomeLocation(plan);
  const transportationType = plan.transportationType;
  const activities = day.activities;
  const segments = day.routeSegments ?? [];
  const symbol = currencySymbol;
  const firstStop = activities.find((a) => a.type !== "travel" && a.location)?.location ?? null;
  const lastStop = [...activities].reverse().find((a) => a.type !== "travel" && a.location)?.location ?? null;
  const hasLeadingTravel = activities[0]?.type === "travel";
  const hasTrailingTravel = activities[activities.length - 1]?.type === "travel";
  const inboundSegment = stay && firstStop ? findHopSegment(segments, stay.name, firstStop.name) : undefined;
  const outboundSegment = stay && lastStop ? findHopSegment(segments, lastStop.name, stay.name) : undefined;

  function renderTravel(
    key: string,
    from: ActivityLocation | null,
    to: ActivityLocation | null,
    segment: RouteSegment | undefined,
    activity?: ItineraryActivity,
  ) {
    if (!from || !to) return null;
    return (
      <TravelLeg
        key={key}
        currencySymbol={symbol}
        transportationType={transportationType}
        from={from}
        to={to}
        segment={segment}
        activity={activity}
        city={city}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-secondary/20 bg-surface shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-4 border-b border-secondary/15 bg-secondary-muted/30 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-ink">{day.displayTitle || `Day ${day.day}`}</h3>
          <p className="mt-0.5 text-sm text-muted">{day.formattedDate}</p>
        </div>
        <p className="text-lg font-bold tabular-nums">{moneyWhole(day.costBreakdown.total, symbol)}</p>
      </header>
      <div>
        {!hasLeadingTravel && inboundSegment ? renderTravel("inbound-stay", stay, firstStop, inboundSegment) : null}
        {activities.map((activity, index) => {
          if (activity.type === "travel") {
            const prev = nearestLocated(activities, index, -1) ?? stay;
            const next = nearestLocated(activities, index, 1) ?? stay;
            const segment = prev && next ? findHopSegment(segments, prev.name, next.name) : undefined;
            return renderTravel(`travel-${activity.time}-${activity.title}`, prev, next, segment, activity);
          }
          return (
            <HarborSlot
              key={`${activity.time}-${activity.title}`}
              activity={activity}
              showChevron
              stayName={stay?.name}
              onFocusStop={onFocusStop}
              palette="harbor"
            />
          );
        })}
        {!hasTrailingTravel && outboundSegment ? renderTravel("outbound-stay", lastStop, stay, outboundSegment) : null}
      </div>
    </div>
  );
}

export function HarborItinerary() {
  const { itinerary, plan } = useDesignLab();
  const signals = useHarborSkin() === "signals";
  const displayPlan = plan.destination ? plan : DALLAS_PLAN;
  const totals = tripTotals(itinerary);
  const [mode, setMode] = useState<"week" | "day">("week");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedStop, setSelectedStop] = useState<string | undefined>(undefined);
  const day = itinerary.days[dayIndex]!;
  const locations = useMemo(() => mapLocations(day), [day]);

  function selectDay(index: number) {
    setDayIndex(index);
    setSelectedStop(undefined);
    setMode("day");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <CurrentStyleHeader itinerary={itinerary} plan={displayPlan} totals={totals} />

        <div className="flex justify-end">
          <div
            className={`inline-flex rounded-full bg-surface p-1.5 ${
              signals
                ? "border border-ink/30"
                : "border-2 border-primary/35 shadow-[var(--shadow-soft)]"
            }`}
            role="group"
            aria-label="Itinerary view"
          >
            <button
              type="button"
              onClick={() => setMode("week")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                mode === "week"
                  ? "bg-primary text-white"
                  : signals
                    ? "text-muted hover:bg-secondary-muted hover:text-ink"
                    : "text-primary hover:bg-secondary-muted"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setMode("day")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                mode === "day"
                  ? "bg-primary text-white"
                  : signals
                    ? "text-muted hover:bg-secondary-muted hover:text-ink"
                    : "text-primary hover:bg-secondary-muted"
              }`}
            >
              Day
            </button>
          </div>
        </div>

        {mode === "week" ? (
          <WeekColumns days={itinerary.days} onSelect={selectDay} />
        ) : (
          <div className="space-y-4">
            <CurrentDayTabs days={itinerary.days} selected={dayIndex} onSelect={(index) => {
              setDayIndex(index);
              setSelectedStop(undefined);
            }} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <HarborDayTimeline
                day={day}
                plan={displayPlan}
                currencySymbol={itinerary.currencySymbol}
                city={itinerary.destinationCity}
                onFocusStop={setSelectedStop}
              />
              <div className="min-h-[22rem] overflow-hidden rounded-3xl border border-secondary/20 bg-surface lg:min-h-0">
                <DayRouteMap
                  locations={locations}
                  selected={selectedStop}
                  label={day.displayTitle || `Day ${day.day}`}
                  city={itinerary.destinationCity}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
