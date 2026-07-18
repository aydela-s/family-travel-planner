"use client";

import DayMap from "@/components/DayMap";
import { displayLocation, formatMoney, formatTime12h, formatTimeOfDayLabel, getTimeOfDay } from "@/lib/format";
import { getBudgetStyleLabel } from "@/lib/format-labels";
import { Itinerary, ItineraryActivity, ItineraryDay } from "@/types/itinerary";

const typeConfig: Record<
  ItineraryActivity["type"],
  { icon: string; label: string; dot: string; card: string }
> = {
  meal: { icon: "🍽️", label: "Meal", dot: "bg-amber-500", card: "border-amber-200/80 bg-amber-50/50" },
  activity: { icon: "🎯", label: "Activity", dot: "bg-sky-500", card: "border-sky-100 bg-white" },
  rest: { icon: "☕", label: "Rest", dot: "bg-emerald-500", card: "border-emerald-100 bg-emerald-50/40" },
  nap: { icon: "😴", label: "Nap", dot: "bg-violet-500 animate-pulse-soft", card: "border-violet-200 bg-violet-50/70" },
  travel: { icon: "🚶", label: "Travel", dot: "bg-slate-400", card: "border-slate-100 bg-slate-50/60" },
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
          isNap ? "shadow-violet-100/60 shadow-md" : isMeal ? "shadow-amber-100/40" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <time className="rounded-lg bg-white/90 px-2.5 py-1 text-sm font-bold tabular-nums text-slate-700 shadow-sm">
            {formatTime12h(activity.time)}
            {activity.endTime ? ` – ${formatTime12h(activity.endTime)}` : ""}
          </time>
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>{cfg.icon}</span> {cfg.label}
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {formatTimeOfDayLabel(activity.timeOfDay ?? getTimeOfDay(activity.time))}
            </span>
          </span>
        </div>
        <h4 className="mt-3 text-base font-bold leading-snug text-slate-900 sm:text-lg">
          {activity.title}
        </h4>
        {activity.location && (
          <p className="mt-1.5 text-xs font-semibold tracking-wide text-slate-500">
            📍 {displayLocation(activity.location.name)}
          </p>
        )}
        {activity.notes && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{activity.notes}</p>
        )}
        {activity.activityCost != null && activity.activityCost > 0 && (
          <p className="mt-2 text-xs font-medium text-slate-500">
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Estimated daily cost
        </h4>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">🍽️ Food</dt>
            <dd className="font-semibold text-slate-900">{formatMoney(c.food, c.currency, symbol)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">🚗 Transport</dt>
            <dd className="font-semibold text-slate-900">{formatMoney(c.transport, c.currency, symbol)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">🎯 Activities</dt>
            <dd className="font-semibold text-slate-900">{formatMoney(c.activities, c.currency, symbol)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
            <dt className="font-bold text-slate-900">Daily total</dt>
            <dd className="font-bold text-sky-700">{formatMoney(c.total, c.currency, symbol)}</dd>
          </div>
        </dl>

        {c.note && (
          <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
            {c.note}
          </p>
        )}
        {day.metrics.transportLabel && (
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
            <strong>Movement:</strong> {day.metrics.transportLabel}
          </p>
        )}
      </div>

      {showAccTips && (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-4 sm:p-5">
          <h4 className="text-sm font-bold text-sky-900">🏠 Stay & meal tips</h4>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-sky-900/90">
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
  const locations = day.activities.filter((a) => a.location).map((a) => a.location!);

  return (
    <section className="animate-fade-in overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/40">
      <header className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Day {day.day}</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{day.formattedDate}</h3>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        <DayMap locations={locations} mapUrl={day.mapUrl} dayLabel={day.formattedDate} />

        <ol className="relative space-y-5">
          <div className="absolute bottom-3 left-[6px] top-3 w-0.5 bg-gradient-to-b from-sky-300 via-slate-200 to-transparent sm:left-[7px]" />
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
  isDemo = false,
}: {
  itinerary: Itinerary;
  isDemo?: boolean;
  isLoading?: boolean;
  /** Kept for call-site compatibility; home link replaces “Plan another trip”. */
  onPlanAnother?: () => void;
}) {
  const tripTotal = itinerary.days.reduce((s, d) => s + d.costs.total, 0);
  const symbol = itinerary.currencySymbol;

  return (
    <div className="space-y-8 animate-fade-in">
      {isDemo && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <strong>Demo mode</strong> — personalized mock itinerary. Set <code className="rounded bg-amber-100 px-1">DEMO_MODE=true</code> in .env.local to always use this (no OpenAI costs).
        </div>
      )}

      <header className="space-y-4 border-b border-slate-100 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">Your trip</p>
          <p className="mt-1 text-sm text-slate-500">{itinerary.tripStartFormatted}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {displayLocation(itinerary.destinationCity)}
          </h2>
          <p className="mt-1 text-slate-600">
            {itinerary.days.length} day{itinerary.days.length !== 1 ? "s" : ""} ·{" "}
            {getBudgetStyleLabel(itinerary.budgetStyle)} trip
          </p>
        </div>

        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          {itinerary.pricingDisclaimer}
        </p>

        <div className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-4 text-white shadow-lg shadow-sky-200">
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
