"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getTripDayCount } from "@/lib/itinerary";
import {
  MAX_TRIP_DAYS,
  todayIso,
} from "@/lib/planning-engine/date-validation";
import { tripLengthHint } from "@/lib/planning-engine/trip-date-context";
import {
  addMonths,
  applyRangeDayClick,
  formatTripDateRangeField,
  getMonthMatrix,
  initialDisplayMonth,
  isIsoInInclusiveRange,
  isTripDateDisabled,
  monthLabel,
} from "@/lib/plan-date-range-picker";
import { DynamicHint } from "./shared";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TripDateRangePickerProps = {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  /** Standalone labeled field, or a compact segment inside a Where/When bar. */
  variant?: "field" | "segment";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function CalendarMonth({
  year,
  monthIndex,
  today,
  anchorStart,
  pickingEnd,
  hoverIso,
  startDate,
  endDate,
  onDayClick,
  onDayHover,
}: {
  year: number;
  monthIndex: number;
  today: string;
  anchorStart: string | null;
  pickingEnd: boolean;
  hoverIso: string | null;
  startDate: string;
  endDate: string;
  onDayClick: (iso: string) => void;
  onDayHover: (iso: string | null) => void;
}) {
  const cells = getMonthMatrix(year, monthIndex);
  const rangeStart = pickingEnd ? anchorStart : startDate || null;
  const rangeEnd = pickingEnd
    ? hoverIso && rangeStart && hoverIso >= rangeStart
      ? hoverIso
      : rangeStart
    : endDate || null;

  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-ink">{monthLabel(year, monthIndex)}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((cell, index) => {
          if (!cell.inMonth) {
            return <span key={`pad-${year}-${monthIndex}-${index}`} className="h-9" aria-hidden />;
          }

          const disabled = isTripDateDisabled(cell.iso, today, anchorStart, pickingEnd);
          const inRange =
            rangeStart && rangeEnd && isIsoInInclusiveRange(cell.iso, rangeStart, rangeEnd);
          const isStart = Boolean(rangeStart && cell.iso === rangeStart);
          const isEnd = Boolean(rangeEnd && cell.iso === rangeEnd);
          const isEndpoint = isStart || isEnd;
          const isToday = cell.iso === today;

          let cellClass =
            "relative flex h-9 w-full items-center justify-center text-sm transition";
          if (disabled) {
            cellClass += " cursor-not-allowed text-muted/40";
          } else {
            cellClass += " cursor-pointer";
          }
          if (inRange && !isEndpoint) {
            cellClass += " bg-primary-muted text-ink";
          }
          if (isEndpoint) {
            cellClass += " z-[1] rounded-full bg-primary font-semibold text-white";
          } else if (!disabled) {
            cellClass += " rounded-full hover:bg-primary-muted";
          }
          if (isToday && !isEndpoint) {
            cellClass += " ring-1 ring-inset ring-primary/40";
          }

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              aria-label={cell.iso}
              aria-pressed={Boolean(inRange)}
              onMouseEnter={() => !disabled && onDayHover(cell.iso)}
              onFocus={() => !disabled && onDayHover(cell.iso)}
              onMouseLeave={() => onDayHover(null)}
              onClick={() => onDayClick(cell.iso)}
              className={cellClass}
            >
              {Number(cell.iso.split("-")[2])}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TripDateRangePicker({
  startDate,
  endDate,
  onChange,
  variant = "field",
  open: openControlled,
  onOpenChange,
}: TripDateRangePickerProps) {
  const today = todayIso();
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const open = openControlled ?? openUncontrolled;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openControlled === undefined) setOpenUncontrolled(next);
  };
  const [pickingEnd, setPickingEnd] = useState(false);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [displayMonth, setDisplayMonth] = useState(() => initialDisplayMonth(startDate, today));
  const wasOpenRef = useRef(false);

  const fieldValue =
    startDate && endDate ? formatTripDateRangeField(startDate, endDate) : "";
  const secondMonth = addMonths(displayMonth.year, displayMonth.monthIndex, 1);
  const completeRange = Boolean(startDate && endDate && startDate !== endDate && !pickingEnd);
  const displayText = completeRange
    ? fieldValue
    : pickingEnd && startDate
      ? `${formatTripDateRangeField(startDate, startDate)} – …`
      : fieldValue;

  // Only reset selection phase when the popover opens — never when startDate updates mid-pick.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDisplayMonth(initialDisplayMonth(startDate, today));
      setPickingEnd(false);
      setHoverIso(null);
    }
    wasOpenRef.current = open;
  }, [open, startDate, today]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleDayClick(clickedIso: string) {
    const result = applyRangeDayClick(clickedIso, startDate, endDate, pickingEnd, today);
    if (!result) return;
    onChange(result.startDate, result.endDate);
    setPickingEnd(result.pickingEnd);
    setHoverIso(null);
    if (result.complete) setOpen(false);
  }

  const trigger =
    variant === "segment" ? (
      <button
        type="button"
        id={`${popoverId}-trigger`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popoverId}
        onClick={() => setOpen(!open)}
        className="w-full rounded-[1.25rem] px-1 py-0.5 text-left outline-none transition hover:bg-background/80 focus-visible:ring-2 focus-visible:ring-primary-muted"
      >
        <span className="block text-xs font-semibold text-ink">When</span>
        <span className={`mt-0.5 block truncate text-sm ${displayText ? "text-ink" : "text-muted"}`}>
          {displayText || "Choose dates"}
        </span>
      </button>
    ) : (
      <button
        type="button"
        id={`${popoverId}-trigger`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popoverId}
        onClick={() => setOpen(!open)}
        className="flex h-[3.25rem] w-full items-center rounded-2xl border border-border bg-surface px-4 text-left text-ink shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-muted"
      >
        <span className={`block w-full truncate ${displayText ? "text-ink" : "text-muted"}`}>
          {displayText || "Choose dates"}
        </span>
      </button>
    );

  return (
    <div ref={rootRef} className="relative">
      {trigger}

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Trip date range"
          className="absolute left-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:left-auto sm:right-0 sm:w-[36rem]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              className="rounded-lg border border-border px-2 py-1 text-sm text-ink hover:bg-secondary-muted"
              onClick={() =>
                setDisplayMonth((current) => addMonths(current.year, current.monthIndex, -1))
              }
            >
              ←
            </button>
            <p className="text-sm text-muted sm:hidden">
              {monthLabel(displayMonth.year, displayMonth.monthIndex)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              className="rounded-lg border border-border px-2 py-1 text-sm text-ink hover:bg-secondary-muted"
              onClick={() =>
                setDisplayMonth((current) => addMonths(current.year, current.monthIndex, 1))
              }
            >
              →
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <CalendarMonth
              year={displayMonth.year}
              monthIndex={displayMonth.monthIndex}
              today={today}
              anchorStart={pickingEnd ? startDate || null : null}
              pickingEnd={pickingEnd}
              hoverIso={hoverIso}
              startDate={startDate}
              endDate={endDate}
              onDayClick={handleDayClick}
              onDayHover={setHoverIso}
            />
            <div className="hidden sm:block">
              <CalendarMonth
                year={secondMonth.year}
                monthIndex={secondMonth.monthIndex}
                today={today}
                anchorStart={pickingEnd ? startDate || null : null}
                pickingEnd={pickingEnd}
                hoverIso={hoverIso}
                startDate={startDate}
                endDate={endDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverIso}
              />
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            {pickingEnd
              ? "Choose your end date — trips can be 1–7 days."
              : "Choose a start date, then an end date."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function TripDateRangeField({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}) {
  const today = todayIso();
  const startInPast = startDate !== "" && startDate < today;
  const endBeforeStart = startDate !== "" && endDate !== "" && endDate < startDate;
  const tooLong =
    startDate !== "" &&
    endDate !== "" &&
    !endBeforeStart &&
    !startInPast &&
    getTripDayCount(startDate, endDate) > MAX_TRIP_DAYS;
  const lengthHint =
    startDate && endDate && !endBeforeStart && !startInPast && !tooLong
      ? tripLengthHint(startDate, endDate)
      : null;

  return (
    <div className="space-y-2">
      <TripDateRangePicker startDate={startDate} endDate={endDate} onChange={onChange} />

      {startInPast && (
        <p className="text-sm font-medium text-error">
          Your trip can&apos;t start in the past — pick today or a future date.
        </p>
      )}
      {endBeforeStart && (
        <p className="text-sm font-medium text-error">
          Your last day must be on or after your first day.
        </p>
      )}
      {tooLong && (
        <p className="text-sm font-medium text-error">
          Trips are limited to {MAX_TRIP_DAYS} days — shorten your dates to continue.
        </p>
      )}

      {lengthHint && <DynamicHint>{lengthHint}</DynamicHint>}
    </div>
  );
}
