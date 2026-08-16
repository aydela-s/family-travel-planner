"use client";

import type { ReactNode } from "react";
import PlanSelectionChips from "@/components/PlanSelectionChips";
import ShareItineraryControls from "@/components/ShareItineraryControls";
import {
  formatMoney,
  formatPlaceRatingBadge,
  formatTime12h,
  formatTimeCompact,
  oneLineNote,
} from "@/lib/format";
import { getBudgetStyleLabelPlain, getTravelStyleLabel } from "@/lib/format-labels";
import { interestSourceLabels } from "@/lib/schedule/interest-map";
import { Itinerary, ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

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
  // Naps/rests are at the stay — a hotel pin is confusing next to "Nap & Quiet Time".
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
  const paid =
    activity.type === "meal" ||
    activity.type === "travel" ||
    (activity.activityCost != null && activity.activityCost > 0)
      ? moneyWhole(activity.activityCost ?? 0, currencySymbol)
      : null;
  const rawNote = activity.notes ? oneLineNote(activity.notes) : "";
  const detailNote = rawNote && !isBoilerplateAgeNote(rawNote) ? rawNote : "";
  const maps = mapsUrl(activity);
  const interestLabels =
    activity.type === "activity" ? interestSourceLabels(activity.interestTags, planInterests) : [];
  const hasDetails = Boolean(detailNote || activity.endTime || maps || interestLabels.length > 0);

  return (
    <details className={`group border-b border-border/80 last:border-b-0 ${style.row}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-3.5 marker:content-none sm:gap-3 sm:px-4 [&::-webkit-details-marker]:hidden">
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
          {ratingBadge && (
            <span className="ml-2 whitespace-nowrap rounded-md bg-background/80 px-1.5 py-0.5 text-xs font-semibold text-muted">
              {ratingBadge}
            </span>
          )}
          {interestLabels.length > 0 && (
            <span className="mt-0.5 block text-xs font-medium text-muted">
              Interest: {interestLabels.join(", ")}
            </span>
          )}
        </span>
        {paid && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{paid}</span>
        )}
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-ink shadow-sm transition group-open:rotate-180 group-open:border-primary group-open:bg-primary group-open:text-white"
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

function DayCostTiles({ day, symbol }: { day: ItineraryDay; symbol: string }) {
  const c = day.costBreakdown;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {(
        [
          ["Food", c.food],
          ["Transport", c.transport],
          ["Activities", c.activities],
        ] as const
      ).map(([label, amount]) => (
        <div
          key={label}
          className="rounded-xl border border-border bg-background px-2.5 py-2.5 text-center sm:px-3 sm:py-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted sm:text-xs">
            {label}
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-ink sm:text-lg">
            {moneyWhole(amount, symbol)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DayCard({
  day,
  symbol,
  planInterests = [],
}: {
  day: ItineraryDay;
  symbol: string;
  planInterests?: string[];
}) {
  const total = moneyWhole(day.costBreakdown.total, symbol);

  return (
    <section className="animate-fade-in overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-ink sm:text-2xl">
            Day {day.day} · {day.displayTitle || day.formattedDate}
          </h3>
          {day.displayTitle ? (
            <p className="mt-0.5 text-sm font-medium text-muted">{day.formattedDate}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-2xl font-bold tabular-nums text-ink sm:text-3xl">{total}</p>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        <DayCostTiles day={day} symbol={symbol} />

        <div className="overflow-hidden rounded-2xl border border-border">
          {day.activities.map((a) => (
            <TimelineItem
              key={`${a.time}-${a.type}-${a.title}`}
              activity={a}
              currencySymbol={symbol}
              planInterests={planInterests}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ItineraryDisplay({
  itinerary,
  plan,
  isDemo = false,
  isLoading = false,
  onApplyPlanUpdate,
  onEditPlanInWizard,
}: {
  itinerary: Itinerary;
  plan?: TripPlan;
  isDemo?: boolean;
  isLoading?: boolean;
  onApplyPlanUpdate?: (updates: Partial<TripPlan>) => void;
  onEditPlanInWizard?: (stepIndex: number, updates?: Partial<TripPlan>) => void;
  /** Kept for call-site compatibility; home link replaces “Plan another trip”. */
  onPlanAnother?: () => void;
}) {
  const tripTotal = itinerary.days.reduce((s, d) => s + d.costs.total, 0);
  const symbol = itinerary.currencySymbol;
  const showSelectionChips = plan && onApplyPlanUpdate && onEditPlanInWizard;

  return (
    <div className="relative space-y-8 animate-fade-in">
      {isLoading && (
        <div
          className="absolute inset-0 z-30 flex items-start justify-center rounded-3xl bg-surface/70 pt-24 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink shadow-[var(--shadow-card)]">
            Updating your trip…
          </p>
        </div>
      )}

      {isDemo && (
        <div className="rounded-2xl border border-warning/30 bg-warning-muted px-4 py-3.5 text-sm text-ink">
          <strong>Demo mode</strong> — personalized mock itinerary (no AI tip enrichment).
        </div>
      )}

      {itinerary.transportNote && (
        <div className="rounded-2xl border border-primary/20 bg-primary-muted px-4 py-3.5 text-sm leading-relaxed text-ink">
          {itinerary.transportNote}
        </div>
      )}

      <header className="space-y-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Your trip</p>
          <p className="mt-1 text-sm text-muted">{itinerary.tripStartFormatted}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {itinerary.destinationCity}
          </h2>
          <p className="mt-1 text-muted">
            {itinerary.days.length} day{itinerary.days.length !== 1 ? "s" : ""} ·{" "}
            {plan
              ? `${getTravelStyleLabel(plan.travelStyle)} pace · ${getBudgetStyleLabelPlain(itinerary.budgetStyle)} budget`
              : `${getBudgetStyleLabelPlain(itinerary.budgetStyle)} budget`}
          </p>
        </div>

        {showSelectionChips && (
          <PlanSelectionChips
            plan={plan}
            disabled={isLoading}
            onApplyUpdate={onApplyPlanUpdate}
            onEditInWizard={onEditPlanInWizard}
          />
        )}

        <p className="rounded-xl border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted">
          {itinerary.pricingDisclaimer}
        </p>

        <div className="rounded-2xl bg-primary px-5 py-4 text-white shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Estimated trip total</p>
          <p className="text-2xl font-bold">{formatMoney(tripTotal, itinerary.currency, symbol)}</p>
        </div>

        <ShareItineraryControls
          itinerary={itinerary}
          plan={plan}
          disabled={isLoading}
        />
      </header>

      <div className="space-y-8">
        {itinerary.days.map((day) => (
          <DayCard
            key={day.day}
            day={day}
            symbol={symbol}
            planInterests={plan?.interests ?? []}
          />
        ))}
      </div>
    </div>
  );
}
