"use client";

import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import { namesMatch } from "@/lib/pricing/transport-planner";
import { useState } from "react";
import { useHarborSkin } from "../harbor-skin";
import {
  activityKindLabel,
  formatClockCompact,
  moneyWhole,
  visibleStops,
} from "../lib/helpers";

export function blockTone(type: ItineraryActivity["type"]) {
  if (type === "meal") return "border-l-4 border-l-accent";
  if (type === "nap" || type === "rest") return "border-l-4 border-l-secondary";
  return "border-l-4 border-l-primary";
}

function slotHover(type: ItineraryActivity["type"]) {
  if (type === "meal") return "hover:bg-accent-muted/50";
  if (type === "nap" || type === "rest") return "hover:bg-secondary-muted/80";
  return "hover:bg-primary-muted/40";
}

function slotOpen(type: ItineraryActivity["type"]) {
  if (type === "meal") return "bg-accent-muted/50";
  if (type === "nap" || type === "rest") return "bg-secondary-muted/80";
  return "bg-primary-muted/40";
}

export function slotCanExpand(activity: ItineraryActivity, stayName?: string) {
  if (activity.type === "nap" || activity.type === "rest") return false;
  if (
    activity.type === "meal" &&
    stayName &&
    activity.location &&
    namesMatch(activity.location.name, stayName)
  ) {
    return false;
  }
  const note = activity.notes?.trim();
  const usefulNote = Boolean(note && !/^Day\s+\d+\s+[—–-]/i.test(note));
  const isAttraction =
    Boolean(activity.location) && (!stayName || !namesMatch(activity.location!.name, stayName));
  return usefulNote || Boolean(activity.rating) || isAttraction;
}

function ExpandChevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-ink shadow-sm transition hover:border-accent hover:bg-accent hover:text-white"
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <path
          d={open ? "M5 12.5 10 7.5 15 12.5" : "M5 7.5 10 12.5 15 7.5"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function HarborSlot({
  activity,
  compact = false,
  showChevron = false,
  stayName,
  onFocusStop,
  palette,
}: {
  activity: ItineraryActivity;
  compact?: boolean;
  showChevron?: boolean;
  stayName?: string;
  onFocusStop?: (name?: string) => void;
  palette?: "harbor" | "signals";
}) {
  const [open, setOpen] = useState(false);
  const skin = useHarborSkin();
  const expandable = showChevron && slotCanExpand(activity, stayName);
  const useSignals = (palette ?? skin) === "signals";
  const hoverFill = expandable
    ? useSignals
      ? "hover:bg-secondary-muted"
      : slotHover(activity.type)
    : "";
  const openFill = useSignals ? "bg-secondary-muted" : slotOpen(activity.type);

  function toggle() {
    if (!expandable) return;
    const next = !open;
    setOpen(next);
    onFocusStop?.(next ? activity.location?.name : undefined);
  }

  const rowClass = `w-full text-left ${blockTone(activity.type)} ${
    showChevron
      ? `border-b border-border/80 px-3 py-3.5 transition last:border-b-0 sm:px-4 ${
          open ? openFill : `bg-surface ${hoverFill}`
        }`
      : `cursor-default rounded-md bg-surface p-3 shadow-sm ${compact ? "p-2.5" : ""}`
  }`;

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {formatClockCompact(activity.time)} · {activityKindLabel(activity.type)}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">{activity.title}</p>
          {activity.activityCost ? (
            <p className="mt-1 text-xs text-muted">{moneyWhole(activity.activityCost)}</p>
          ) : null}
        </div>
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Collapse stop" : "Expand stop"}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="cursor-pointer"
          >
            <ExpandChevron open={open} />
          </button>
        ) : null}
      </div>
      {open && activity.notes ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{activity.notes}</p>
      ) : null}
    </>
  );

  if (!expandable) {
    return <div className={rowClass}>{body}</div>;
  }

  return (
    <div className={rowClass} onClick={toggle}>
      {body}
    </div>
  );
}

export function BoardBlocks({
  day,
  compact = false,
  showChevron = false,
}: {
  day: ItineraryDay;
  compact?: boolean;
  showChevron?: boolean;
}) {
  return (
    <div className="space-y-2">
      {visibleStops(day).map((activity) => {
        const key = `${day.day}-${activity.time}-${activity.title}`;
        return (
          <HarborSlot key={key} activity={activity} compact={compact} showChevron={showChevron} />
        );
      })}
    </div>
  );
}

export function DayTabs({
  days,
  selected,
  onSelect,
}: {
  days: ItineraryDay[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Trip days">
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
            className={`flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-full text-center ${
              active ? "bg-[#016d76] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            <span className="text-xs font-semibold">Day {day.day}</span>
            <span className={`text-[10px] ${active ? "text-white/80" : "text-slate-500"}`}>{sub}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SpendBars({ days }: { days: ItineraryDay[] }) {
  const maxDay = Math.max(...days.map((day) => day.costBreakdown.total), 1);
  return (
    <div className="flex gap-4 overflow-x-auto">
      {days.map((day) => (
        <div key={day.date} className="min-w-[7rem] flex-1">
          <p className="text-[11px] text-slate-500">
            Day {day.day} · {moneyWhole(day.costBreakdown.total)}
          </p>
          <div className="mt-1 h-2 rounded bg-slate-200">
            <div
              className="h-2 rounded bg-[#016d76]"
              style={{ width: `${Math.max(12, (day.costBreakdown.total / maxDay) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WeekColumns({
  days,
  selected,
  onSelect,
  showChevron = false,
}: {
  days: ItineraryDay[];
  selected?: number;
  onSelect?: (index: number) => void;
  showChevron?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {days.map((day, index) => {
        const active = selected === index;
        return (
          <section
            key={day.date}
            className={`min-w-0 rounded-2xl border p-2.5 transition ${
              onSelect
                ? "hover:border-secondary hover:bg-secondary-muted/60 hover:shadow-[var(--shadow-soft)]"
                : "border-transparent"
            } ${active ? "border-primary bg-primary-muted/50" : "border-border bg-surface"}`}
            onClick={() => onSelect?.(index)}
          >
            <button
              type="button"
              disabled={!onSelect}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(index);
              }}
              className={`mb-2 w-full cursor-pointer text-left text-sm font-semibold ${
                active ? "text-primary" : "text-ink"
              }`}
            >
              {day.weekday} {day.date.slice(-2)}
              <span className="mt-0.5 block text-xs font-normal text-muted">{day.displayTitle}</span>
            </button>
            <BoardBlocks day={day} compact showChevron={showChevron} />
          </section>
        );
      })}
    </div>
  );
}
