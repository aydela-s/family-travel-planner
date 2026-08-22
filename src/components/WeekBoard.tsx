"use client";

import { formatTimeShort } from "@/lib/format";
import { weekBoardStopLabel } from "@/lib/week-board-labels";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";

function blockTone(type: ItineraryActivity["type"]): string {
  if (type === "meal") return "border-l-4 border-l-accent";
  if (type === "nap" || type === "rest") return "border-l-4 border-l-secondary";
  return "border-l-4 border-l-primary";
}

function kindLabel(type: ItineraryActivity["type"]): string {
  if (type === "meal") return "Meal";
  if (type === "nap") return "Nap";
  if (type === "rest") return "Rest";
  if (type === "travel") return "Travel";
  return "Out";
}

export function WeekBoard({
  days,
  selectedIndex,
  disabled = false,
  currencySymbol = "$",
  onSelectDay,
}: {
  days: ItineraryDay[];
  selectedIndex?: number;
  disabled?: boolean;
  currencySymbol?: string;
  onSelectDay?: (day: ItineraryDay, index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {days.map((day, index) => {
        const active = selectedIndex === index;
        const stops = day.activities.filter((activity) => activity.type !== "travel");
        const total = Math.round(day.costBreakdown.total);
        return (
          <section
            key={day.date}
            className={`min-w-0 rounded-2xl border p-2.5 transition ${
              onSelectDay
                ? "hover:border-secondary hover:bg-secondary-muted/60 hover:shadow-[var(--shadow-soft)]"
                : "border-transparent"
            } ${active ? "border-primary bg-primary-muted/50" : "border-border bg-surface"} ${
              disabled ? "pointer-events-none opacity-60" : onSelectDay ? "cursor-pointer" : ""
            }`}
            onClick={() => {
              if (disabled || !onSelectDay) return;
              onSelectDay(day, index);
            }}
          >
            <button
              type="button"
              disabled={disabled || !onSelectDay}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDay?.(day, index);
              }}
              className={`mb-2 flex w-full cursor-pointer items-start justify-between gap-2 text-left text-sm font-semibold ${
                active ? "text-primary" : "text-ink"
              }`}
            >
              <span className="min-w-0">
                {day.weekday} {day.date.slice(-2)}
                <span className="mt-0.5 block text-xs font-normal text-muted">{day.displayTitle}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                ~{currencySymbol}
                {total.toLocaleString()}
              </span>
            </button>
            <div className="space-y-2">
              {stops.map((activity) => (
                <div
                  key={`${activity.time}-${activity.title}`}
                  className={`w-full rounded-md bg-surface p-2.5 text-left shadow-sm ${blockTone(activity.type)}`}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {formatTimeShort(activity.time)} · {kindLabel(activity.type)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{weekBoardStopLabel(activity)}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
