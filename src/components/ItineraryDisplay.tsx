"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { DayRouteMap } from "@/components/DayRouteMap";
import { WeekBoard } from "@/components/WeekBoard";
import PlanSelectionChips from "@/components/PlanSelectionChips";
import ShareItineraryControls from "@/components/ShareItineraryControls";
import {
  formatAdultsLabel,
  formatKidsWithAges,
  formatPlaceRatingBadge,
  formatTime12h,
  formatTimeCompact,
  oneLineNote,
  shouldShowLineItemCost,
} from "@/lib/format";
import { formatCoverDateRange } from "@/lib/itinerary-export";
import { interestSourceLabels } from "@/lib/schedule/interest-map";
import { stayHomeLocation } from "@/lib/planning-engine/stay-home";
import {
  ActivityLocation,
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
  RouteSegment,
} from "@/types/itinerary";
import { TransportationType, TripPlan } from "@/types/trip-plan";
import { namesMatch } from "@/lib/pricing/transport-planner";
import { formatMiles } from "@/lib/format-distance";
import { getTransportationLabel } from "@/lib/format-labels";

type TypeStyle = {
  icon: ReactNode;
  row: string;
  iconWrap: string;
};

function MealIcon() {
  return (
    <svg viewBox="0 0 24 24" className="block h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
      <path
        d="M8 3v8M8 11v10M6 3v5a2 2 0 0 0 4 0V3M16 3v7c0 1.5 1 2 2 2v9M16 3c0 3 0 5-2 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="block h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
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

function NapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="block h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
      <path
        d="M12 4.5A6.5 6.5 0 1 0 18.2 14.2 5.25 5.25 0 0 1 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RestIcon() {
  return (
    <svg viewBox="0 0 24 24" className="block h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
      <path
        d="M6 15h12M8 15V9a4 4 0 0 1 8 0v6M9 19h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TravelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="block h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
      <path
        d="M4 16h16M7 16V8l5-3 5 3v8M9 16v3M15 16v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandChevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" fill="none" aria-hidden>
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

function dayTabSublabel(day: ItineraryDay): string {
  const parsed = new Date(`${day.date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return day.weekday ? day.weekday.slice(0, 3) : "";
  }
  const dateNum = parsed.getDate();
  const weekday = parsed.toLocaleDateString("en-US", { weekday: "short" });
  return `${dateNum} ${weekday}`;
}

const typeStyle: Record<ItineraryActivity["type"], TypeStyle> = {
  meal: {
    icon: <MealIcon />,
    row: "bg-accent-muted/50",
    iconWrap: "bg-accent text-white",
  },
  activity: {
    icon: <ActivityIcon />,
    row: "bg-primary-muted/40",
    iconWrap: "bg-itinerary-activity text-white",
  },
  rest: {
    icon: <RestIcon />,
    row: "bg-secondary-muted/80",
    iconWrap: "bg-itinerary-rest text-white",
  },
  nap: {
    icon: <NapIcon />,
    row: "bg-secondary-muted/80",
    iconWrap: "bg-itinerary-rest text-white",
  },
  travel: {
    icon: <TravelIcon />,
    row: "bg-surface",
    iconWrap: "bg-muted text-white",
  },
};

function moneyWhole(amount: number, symbol: string): string {
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

/** Age-band boilerplate like "Day 3 — mixed ages (ages 9–14)." */
function isBoilerplateAgeNote(note: string): boolean {
  return /^Day\s+\d+\s+[—–-]/i.test(note.trim());
}

/** Google Maps URL preferring place id / place name over raw coordinates. */
function mapsUrl(activity: ItineraryActivity): string | null {
  // Naps/rests are at the stay — a hotel pin is confusing next to "Nap".
  if (activity.type === "nap" || activity.type === "rest") return null;

  const name = activity.location?.name?.trim();
  const lat = activity.location?.lat;
  const lng = activity.location?.lng;

  // Grocery pins are synthetic ("Supermarket near Belmont Park") — pin the map
  // on the anchor coords so Maps doesn't fall back to the user's current city.
  if (/supermarket|grocery/i.test(activity.title) || /supermarket|grocery/i.test(name ?? "")) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps/search/Supermarket/@${lat},${lng},15z`;
    }
    return null;
  }

  if (activity.placeId) {
    const query = encodeURIComponent(name || "place");
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(activity.placeId)}`;
  }
  if (name && !/\barea\b/i.test(name)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  }
  if (activity.location && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return null;
}

function locationAlreadyInTitle(title: string, locationName: string): boolean {
  const t = title.toLowerCase();
  const n = locationName.toLowerCase().trim();
  if (!n) return true;
  if (t.includes(n)) return true;
  const stem = n.replace(/\s+(park|museum|area|café|cafe)$/i, "").trim();
  return stem.length > 3 && t.includes(stem);
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

function hasFiniteCoords(loc: ActivityLocation | null | undefined): loc is ActivityLocation {
  return (
    !!loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  );
}

/** Prefer lat/lng so Maps opens the real hop, not a wrong place-name match. */
function directionsUrl(
  from: ActivityLocation,
  to: ActivityLocation,
  transportationType: TransportationType | "" | undefined,
): string {
  const travelmode = mapsTravelMode(transportationType);
  const origin = hasFiniteCoords(from)
    ? `${from.lat},${from.lng}`
    : encodeURIComponent(from.name);
  const destination = hasFiniteCoords(to)
    ? `${to.lat},${to.lng}`
    : encodeURIComponent(to.name);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${travelmode}`;
}

function findHopSegment(
  segments: RouteSegment[],
  fromName: string,
  toName: string,
): RouteSegment | undefined {
  return segments.find(
    (s) =>
      namesMatch(s.from, fromName) &&
      namesMatch(s.to, toName) &&
      (s.distanceKm > 0 || s.cost > 0 || s.durationMin > 0),
  );
}

function nearestLocated(
  activities: ItineraryActivity[],
  fromIndex: number,
  direction: -1 | 1,
): ActivityLocation | null {
  for (let i = fromIndex + direction; i >= 0 && i < activities.length; i += direction) {
    const a = activities[i]!;
    if (a.type === "travel") continue;
    if (a.location) return a.location;
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
}: {
  currencySymbol: string;
  transportationType?: TransportationType | "";
  from: ActivityLocation | null;
  to: ActivityLocation | null;
  segment?: RouteSegment;
  /** Optional injected travel row — used for cost / notes fallback. */
  activity?: ItineraryActivity;
}) {
  const miles =
    segment && segment.distanceKm > 0
      ? formatMiles(segment.distanceKm)
      : (activity?.notes?.match(/[\d.]+ mi/)?.[0] ?? null);
  const duration =
    segment && segment.durationMin > 0
      ? `~${segment.durationMin} min`
      : (activity?.notes?.match(/~\d+\s*min/)?.[0] ?? null);
  const costAmount =
    activity?.activityCost != null
      ? activity.activityCost
      : segment
        ? segment.cost
        : null;
  const cost =
    costAmount != null && costAmount > 0 ? moneyWhole(costAmount, currencySymbol) : null;
  const maps =
    from && to ? directionsUrl(from, to, transportationType) : null;
  const meta = [miles, duration, cost].filter(Boolean).join(" · ");

  return (
    <div className="relative flex gap-3 border-b border-border/60 px-3 py-2.5 sm:gap-3.5 sm:px-4">
      <div className="flex w-7 shrink-0 flex-col items-center self-stretch" aria-hidden>
        <span className="w-px flex-1 border-l border-dashed border-muted/50" />
        <span className="my-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
        <span className="w-px flex-1 border-l border-dashed border-muted/50" />
      </div>
      <div className="min-w-0 flex-1 py-0.5 text-sm leading-relaxed text-muted">
        <p className="font-semibold not-italic text-ink">{travelModeLabel(transportationType)}</p>
        {meta ? <p className="italic [font-synthesis:style]">{meta}</p> : null}
        {maps && (
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
        )}
      </div>
    </div>
  );
}

function TimelineItem({
  activity,
  currencySymbol,
  planInterests = [],
}: {
  activity: ItineraryActivity;
  currencySymbol: string;
  planInterests?: string[];
}) {
  const style = typeStyle[activity.type];
  const ratingBadge = formatPlaceRatingBadge(activity.rating, activity.reviewCount);
  const paid = shouldShowLineItemCost(activity)
    ? moneyWhole(activity.activityCost!, currencySymbol)
    : null;
  const rawNote = activity.notes ? oneLineNote(activity.notes) : "";
  const detailNote = rawNote && !isBoilerplateAgeNote(rawNote) ? rawNote : "";
  const maps = mapsUrl(activity);
  const interestLabels =
    activity.type === "activity" ? interestSourceLabels(activity.interestTags, planInterests) : [];
  const hasDetails = Boolean(
    detailNote || activity.endTime || maps || interestLabels.length > 0 || ratingBadge,
  );

  const body = (
    <>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}
        >
          {style.icon}
        </span>
        <time className="w-12 shrink-0 text-xs font-medium tabular-nums text-muted sm:w-14">
          {formatTimeCompact(activity.time)}
        </time>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ink sm:text-base">
          {activity.title}
          {interestLabels.length > 0 && (
            <span className="mt-0.5 block text-xs font-medium text-muted">
              Interest: {interestLabels.join(", ")}
            </span>
          )}
        </span>
        {paid && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{paid}</span>
        )}
    </>
  );

  if (!hasDetails) {
    return (
      <div className={`flex items-center gap-2.5 border-b border-border/80 px-3 py-3.5 last:border-b-0 sm:gap-3 sm:px-4 ${style.row}`}>
        {body}
      </div>
    );
  }

  return (
    <details className={`group border-b border-border/80 last:border-b-0 ${style.row}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-3.5 marker:content-none sm:gap-3 sm:px-4 [&::-webkit-details-marker]:hidden">
        {body}
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-ink shadow-sm transition group-open:rotate-180 group-open:border-accent group-open:bg-accent group-open:text-white"
          aria-hidden
        >
          <ExpandChevron />
        </span>
      </summary>

      {hasDetails && (
        <div className="space-y-1.5 px-3 pb-3.5 pl-[3.25rem] text-sm text-muted sm:px-4 sm:pl-[4.25rem]">
          {activity.endTime && (
            <p>
              {formatTime12h(activity.time)} – {formatTime12h(activity.endTime)}
            </p>
          )}
          {ratingBadge ? (
            <p>
              <span className="inline-block whitespace-nowrap rounded-md bg-background/80 px-1.5 py-0.5 text-xs font-semibold text-muted">
                {ratingBadge}
              </span>
            </p>
          ) : null}
          {maps && activity.location && (
            <p>
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {locationAlreadyInTitle(activity.title, activity.location.name)
                  ? "Open in Google Maps"
                  : `Open ${activity.location.name} in Maps`}
              </a>
            </p>
          )}
          {detailNote && <p className="leading-relaxed">{detailNote}</p>}
        </div>
      )}
    </details>
  );
}

function TripTotalBanner({
  tripTotal,
  activities,
  food,
  transport,
  symbol,
  disclaimer,
}: {
  tripTotal: number;
  activities: number;
  food: number;
  transport: number;
  symbol: string;
  disclaimer: string;
}) {
  const segments = [
    {
      key: "activities",
      label: "Activities",
      amount: activities,
      wrap: "border-border bg-background",
      dot: "bg-itinerary-activity",
    },
    {
      key: "food",
      label: "Food",
      amount: food,
      wrap: "border-border bg-background",
      dot: "bg-itinerary-meal",
    },
    {
      key: "transport",
      label: "Transport",
      amount: transport,
      wrap: "border-border bg-background",
      dot: "bg-itinerary-rest",
    },
  ] as const;

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-muted">
          <BudgetWalletIcon />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Estimated trip total
          </p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight text-ink">
            {moneyWhole(tripTotal, symbol)}
          </p>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={`min-w-0 rounded-2xl border px-2.5 py-3 text-center sm:px-3.5 sm:text-left ${segment.wrap}`}
          >
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

      <p className="mt-4 text-xs leading-relaxed text-muted">{disclaimer}</p>
    </section>
  );
}

function DayTabs({
  days,
  selectedDay,
  onSelect,
  disabled = false,
  tabsId,
}: {
  days: ItineraryDay[];
  selectedDay: number;
  onSelect: (day: number) => void;
  disabled?: boolean;
  tabsId: string;
}) {

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = days.findIndex((day) => day.day === selectedDay);
    if (index < 0) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = days[(index + delta + days.length) % days.length];
    if (next) onSelect(next.day);
  }

  return (
    <div
      role="tablist"
      aria-label="Trip days"
      onKeyDown={onKeyDown}
      className="-mx-1 flex gap-3 overflow-x-auto px-1 py-1"
    >
      {days.map((day) => {
        const selected = day.day === selectedDay;
        return (
          <button
            key={day.day}
            type="button"
            role="tab"
            id={`${tabsId}-tab-${day.day}`}
            aria-selected={selected}
            aria-controls={`${tabsId}-panel-${day.day}`}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(day.day)}
            className={`box-border flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border text-center transition sm:h-[4.75rem] sm:w-[4.75rem] ${
              selected
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-ink hover:bg-secondary-muted"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className="text-xs font-semibold sm:text-sm">Day {day.day}</span>
            <span className={`text-[10px] sm:text-xs ${selected ? "text-white/85" : "text-muted"}`}>
              {dayTabSublabel(day)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DayCard({
  day,
  symbol,
  plan,
  planInterests = [],
  panelId,
  labelledBy,
}: {
  day: ItineraryDay;
  symbol: string;
  plan?: TripPlan;
  planInterests?: string[];
  panelId?: string;
  labelledBy?: string;
}) {
  const stay = plan ? stayHomeLocation(plan) : null;
  const transportationType = plan?.transportationType;
  const activities = day.activities;
  const segments = day.routeSegments ?? [];

  const firstStop = activities.find((a) => a.type !== "travel" && a.location)?.location ?? null;
  const lastStop =
    [...activities].reverse().find((a) => a.type !== "travel" && a.location)?.location ?? null;

  const hasLeadingTravel = activities[0]?.type === "travel";
  const hasTrailingTravel = activities[activities.length - 1]?.type === "travel";

  const inboundSegment =
    stay && firstStop ? findHopSegment(segments, stay.name, firstStop.name) : undefined;
  const outboundSegment =
    stay && lastStop ? findHopSegment(segments, lastStop.name, stay.name) : undefined;

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
      />
    );
  }

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className="animate-fade-in overflow-hidden rounded-3xl border border-secondary/20 bg-surface shadow-[var(--shadow-card)]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-secondary/15 bg-secondary-muted/30 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink sm:text-xl">
            {day.displayTitle || `Day ${day.day}`}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{day.formattedDate}</p>
        </div>
        <p className="shrink-0 pt-0.5 text-lg font-bold tabular-nums tracking-tight text-ink sm:text-xl">
          {moneyWhole(day.costBreakdown.total, symbol)}
        </p>
      </header>

      <div className="overflow-hidden">
        {!hasLeadingTravel &&
          inboundSegment &&
          renderTravel("inbound-stay", stay, firstStop, inboundSegment)}

        {activities.map((a, index) => {
          if (a.type === "travel") {
            const prev = nearestLocated(activities, index, -1) ?? stay;
            const next = nearestLocated(activities, index, 1) ?? stay;
            const segment =
              prev && next
                ? findHopSegment(segments, prev.name, next.name)
                : undefined;
            return renderTravel(
              `travel-${a.time}-${a.title}`,
              prev,
              next,
              segment,
              a,
            );
          }

          return (
            <TimelineItem
              key={`${a.time}-${a.type}-${a.title}`}
              activity={a}
              currencySymbol={symbol}
              planInterests={planInterests}
            />
          );
        })}

        {!hasTrailingTravel &&
          outboundSegment &&
          renderTravel("outbound-stay", lastStop, stay, outboundSegment)}
      </div>
    </section>
  );
}

export default function ItineraryDisplay({
  itinerary,
  plan,
  isLoading = false,
  onApplyPlanUpdate,
  onEditPlanInWizard,
}: {
  itinerary: Itinerary;
  plan?: TripPlan;
  isLoading?: boolean;
  onApplyPlanUpdate?: (updates: Partial<TripPlan>) => void;
  onEditPlanInWizard?: (stepIndex: number, updates?: Partial<TripPlan>) => void;
  /** Kept for call-site compatibility; home link replaces “Plan another trip”. */
  onPlanAnother?: () => void;
}) {
  const tripTotal = itinerary.days.reduce((s, d) => s + d.costs.total, 0);
  const tripActivities = itinerary.days.reduce((s, d) => s + d.costBreakdown.activities, 0);
  const tripFood = itinerary.days.reduce((s, d) => s + d.costBreakdown.food, 0);
  const tripTransport = itinerary.days.reduce((s, d) => s + d.costBreakdown.transport, 0);
  const symbol = itinerary.currencySymbol;
  const showSelectionChips = plan && onApplyPlanUpdate && onEditPlanInWizard;
  const tabsId = useId();
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(itinerary.days[0]?.day ?? 1);

  useEffect(() => {
    const ids = itinerary.days.map((day) => day.day);
    if (!ids.includes(selectedDay)) {
      setSelectedDay(ids[0] ?? 1);
    }
  }, [itinerary.days, selectedDay]);

  const activeDay =
    itinerary.days.find((day) => day.day === selectedDay) ?? itinerary.days[0];
  const mapLocations = useMemo(() => {
    if (!activeDay) return [];
    return activeDay.activities
      .filter((activity) => activity.location && activity.type !== "nap" && activity.type !== "rest")
      .map((activity) => activity.location!)
      .filter((location, index, list) => list.findIndex((item) => item.name === location.name) === index);
  }, [activeDay]);

  function selectDay(dayNumber: number) {
    setSelectedDay(dayNumber);
    setView("day");
  }

  return (
    <div className="relative space-y-6 animate-fade-in sm:space-y-8">
      {isLoading && (
        <div
          className="absolute inset-0 z-30 flex items-start justify-center rounded-3xl bg-background/70 pt-24 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink shadow-[var(--shadow-card)]">
            Updating your trip…
          </p>
        </div>
      )}

      {itinerary.transportNote && (
        <div className="rounded-2xl border border-primary/20 bg-primary-muted px-4 py-3.5 text-sm leading-relaxed text-ink">
          {itinerary.transportNote}
        </div>
      )}

      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              <PinIcon />
              <span>{itinerary.destinationCity || itinerary.destination}</span>
            </h2>
            <p className="mt-2 text-base text-muted sm:text-lg">
              {plan
                ? [
                    plan.startDate && plan.endDate
                      ? formatCoverDateRange(plan.startDate, plan.endDate) ||
                        itinerary.tripStartFormatted
                      : itinerary.tripStartFormatted,
                    formatAdultsLabel(plan.adults),
                    formatKidsWithAges(plan.children) || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : itinerary.tripStartFormatted}
            </p>
          </div>

          <div className="shrink-0">
            <ShareItineraryControls
              itinerary={itinerary}
              plan={plan}
              disabled={isLoading}
            />
          </div>
        </div>

        {showSelectionChips && (
          <PlanSelectionChips
            plan={plan}
            disabled={isLoading}
            onApplyUpdate={onApplyPlanUpdate}
            onEditInWizard={onEditPlanInWizard}
          />
        )}
      </header>

      <TripTotalBanner
        tripTotal={tripTotal}
        activities={tripActivities}
        food={tripFood}
        transport={tripTransport}
        symbol={symbol}
        disclaimer={itinerary.pricingDisclaimer}
      />

      {itinerary.days.length > 0 ? (
        <div className="flex justify-end">
          <div
            className="inline-grid grid-cols-2 rounded-full border border-ink/30 bg-surface p-1.5"
            role="group"
            aria-label="Itinerary view"
          >
            <button
              type="button"
              onClick={() => setView("week")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                view === "week" ? "bg-primary text-white" : "text-muted hover:bg-secondary-muted hover:text-ink"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("day")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                view === "day" ? "bg-primary text-white" : "text-muted hover:bg-secondary-muted hover:text-ink"
              }`}
            >
              Day
            </button>
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <WeekBoard
          days={itinerary.days}
          disabled={isLoading}
          currencySymbol={symbol}
          onSelectDay={(day) => selectDay(day.day)}
        />
      ) : (
        <div className="space-y-4">
          {itinerary.days.length > 0 && (
            <DayTabs
              days={itinerary.days}
              selectedDay={activeDay?.day ?? selectedDay}
              onSelect={setSelectedDay}
              disabled={isLoading}
              tabsId={tabsId}
            />
          )}
          {activeDay ? (
            <div className="grid min-h-[22rem] gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <DayCard
                day={activeDay}
                symbol={symbol}
                plan={plan}
                planInterests={plan?.interests ?? []}
                panelId={`${tabsId}-panel-${activeDay.day}`}
                labelledBy={`${tabsId}-tab-${activeDay.day}`}
              />
              <div className="min-h-[22rem] overflow-hidden rounded-3xl border border-secondary/20 bg-surface">
                <DayRouteMap
                  locations={mapLocations}
                  selected={undefined}
                  label={activeDay.displayTitle || `Day ${activeDay.day}`}
                  city={itinerary.destinationCity}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
