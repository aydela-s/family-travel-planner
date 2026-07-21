"use client";

import PlanSelectionChips from "@/components/PlanSelectionChips";
import { displayLocation, formatMoney, formatTime12h, formatTimeOfDayLabel, getTimeOfDay } from "@/lib/format";
import { getBudgetStyleLabel } from "@/lib/format-labels";
import { Itinerary, ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

const typeConfig: Record<
  ItineraryActivity["type"],
  { icon: string; label: string; dot: string; card: string }
> = {
  meal: {
    icon: "🍽️",
    label: "Meal",
    dot: "bg-itinerary-meal",
    card: "border-accent/25 bg-accent-muted/60",
  },
  activity: {
    icon: "🎯",
    label: "Activity",
    dot: "bg-itinerary-activity",
    card: "border-border bg-surface",
  },
  rest: {
    icon: "☕",
    label: "Rest",
    dot: "bg-itinerary-rest",
    card: "border-secondary/30 bg-secondary-muted/70",
  },
  nap: {
    icon: "😴",
    label: "Rest",
    dot: "bg-itinerary-rest animate-pulse-soft",
    card: "border-secondary/40 bg-secondary-muted",
  },
  travel: {
    icon: "🚶",
    label: "Activity",
    dot: "bg-itinerary-transport",
    card: "border-border bg-background",
  },
};

function TimelineItem({ activity, currencySymbol }: { activity: ItineraryActivity; currencySymbol: string }) {
  const cfg = typeConfig[activity.type];
  const isNap = activity.type === "nap";
  const isMeal = activity.type === "meal";

  return (
    <li className="relative pl-9 sm:pl-11">
      <span className={`absolute left-0 top-5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${cfg.dot}`} />
      <article
        className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md sm:p-5 ${cfg.card} ${
          isNap ? "shadow-secondary/20 shadow-md" : isMeal ? "shadow-accent/10" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <time className="rounded-lg bg-surface/90 px-2.5 py-1 text-sm font-bold tabular-nums text-ink shadow-sm">
            {formatTime12h(activity.time)}
            {activity.endTime ? ` – ${formatTime12h(activity.endTime)}` : ""}
          </time>
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <span>{cfg.icon}</span> {cfg.label}
            <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {formatTimeOfDayLabel(activity.timeOfDay ?? getTimeOfDay(activity.time))}
            </span>
          </span>
        </div>
        <h4 className="mt-3 text-base font-bold leading-snug text-ink sm:text-lg">
          {activity.title}
        </h4>
        {activity.location && (
          <p className="mt-1.5 text-xs font-semibold tracking-wide text-muted">
            📍 {displayLocation(activity.location.name)}
          </p>
        )}
        {activity.notes && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{activity.notes}</p>
        )}
        {activity.activityCost != null && activity.activityCost > 0 && (
          <p className="mt-2 text-xs font-medium text-muted">
            Family activity est. {formatMoney(activity.activityCost, "", currencySymbol)}
          </p>
        )}
      </article>
    </li>
  );
}

function CostBreakdown({ day, symbol }: { day: ItineraryDay; symbol: string }) {
  const c = day.costBreakdown;
  const showAccTips = day.accommodationTips.length > 0;

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
        <h4 className="text-sm font-bold uppercase tracking-wider text-muted">
          Estimated daily cost
        </h4>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">🍽️ Food</dt>
            <dd className="font-semibold text-ink">{formatMoney(c.food, c.currency, symbol)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">🚗 Transport</dt>
            <dd className="font-semibold text-ink">{formatMoney(c.transport, c.currency, symbol)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">🎯 Activities</dt>
            <dd className="font-semibold text-ink">{formatMoney(c.activities, c.currency, symbol)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base">
            <dt className="font-bold text-ink">Daily total</dt>
            <dd className="font-bold text-itinerary-budget">{formatMoney(c.total, c.currency, symbol)}</dd>
          </div>
        </dl>

        {c.note && (
          <p className="mt-3 rounded-xl border border-secondary/25 bg-secondary-muted px-3 py-2 text-xs leading-relaxed text-ink">
            {c.note}
          </p>
        )}
        {day.metrics.transportLabel && (
          <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
            <strong>Movement:</strong> {day.metrics.transportLabel}
          </p>
        )}
      </div>

      {showAccTips && (
        <div className="rounded-2xl border border-primary/20 bg-primary-muted p-4 sm:p-5">
          <h4 className="text-sm font-bold text-primary">🏠 Stay & meal tips</h4>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink">
            {day.accommodationTips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DayCard({
  day,
  symbol,
}: {
  day: ItineraryDay;
  symbol: string;
}) {
  return (
    <section className="animate-fade-in overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <header className="border-b border-border bg-primary-muted/40 px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Day {day.day}</p>
        <h3 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{day.formattedDate}</h3>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        <ol className="relative space-y-5">
          <div className="absolute bottom-3 left-[6px] top-3 w-0.5 bg-gradient-to-b from-primary/40 via-border to-transparent sm:left-[7px]" />
          {day.activities.map((a) => (
            <TimelineItem
              key={`${a.time}-${a.type}-${a.title}`}
              activity={a}
              currencySymbol={symbol}
            />
          ))}
        </ol>

        <CostBreakdown day={day} symbol={symbol} />
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
          <strong>Demo mode</strong> — personalized mock itinerary. Set <code className="rounded bg-warning/15 px-1">DEMO_MODE=true</code> in .env.local to always use this (no OpenAI costs).
        </div>
      )}

      <header className="space-y-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Your trip</p>
          <p className="mt-1 text-sm text-muted">{itinerary.tripStartFormatted}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {displayLocation(itinerary.destinationCity)}
          </h2>
          <p className="mt-1 text-muted">
            {itinerary.days.length} day{itinerary.days.length !== 1 ? "s" : ""} ·{" "}
            {getBudgetStyleLabel(itinerary.budgetStyle)} trip
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
      </header>

      <div className="space-y-8">
        {itinerary.days.map((day) => (
          <DayCard key={day.day} day={day} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}
