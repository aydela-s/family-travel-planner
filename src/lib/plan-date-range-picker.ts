import { getTripDayCount } from "@/lib/itinerary";
import {
  MAX_TRIP_DAYS,
  maxEndDateForStart,
  todayIso,
} from "@/lib/planning-engine/date-validation";

export type MonthCell = {
  iso: string;
  inMonth: boolean;
};

/** Short label for the wizard date-range field — e.g. "Aug 18 – Aug 22". */
export function formatTripDateRangeField(startIso: string, endIso: string): string {
  if (!startIso) return "";
  const fmt = (iso: string) => {
    const date = new Date(`${iso}T12:00:00`);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (!endIso || startIso === endIso) return fmt(startIso);
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

export function toIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(iso: string): { year: number; monthIndex: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, monthIndex: m - 1, day: d };
}

export function addMonths(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function getMonthMatrix(year: number, monthIndex: number): MonthCell[] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: MonthCell[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ iso: "", inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toIsoDate(year, monthIndex, day), inMonth: true });
  }
  return cells;
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function isTripDateDisabled(
  iso: string,
  today: string,
  anchorStart: string | null,
  pickingEnd: boolean,
): boolean {
  if (!iso || iso < today) return true;
  if (!pickingEnd || !anchorStart) return false;
  // While choosing an end date, only allow the inclusive 1–7 day window from start.
  if (iso < anchorStart) return true;
  const maxEnd = maxEndDateForStart(anchorStart);
  return iso > maxEnd;
}

export function isValidTripEndDate(startIso: string, endIso: string, today: string = todayIso()): boolean {
  if (!startIso || !endIso) return false;
  if (endIso < today) return false;
  if (endIso < startIso) return false;
  return getTripDayCount(startIso, endIso) <= MAX_TRIP_DAYS;
}

/** Inclusive ISO dates between start and end when both are set and valid. */
export function eachIsoDayInclusive(startIso: string, endIso: string): string[] {
  if (!startIso || !endIso || endIso < startIso) return [];
  const days = getTripDayCount(startIso, endIso);
  const start = parseIsoDate(startIso);
  const anchor = new Date(start.year, start.monthIndex, start.day);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    out.push(toIsoDate(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return out;
}

export function isIsoInInclusiveRange(
  iso: string,
  startIso: string,
  endIso: string,
): boolean {
  if (!iso || !startIso || !endIso) return false;
  return iso >= startIso && iso <= endIso;
}

export type RangeClickResult = {
  startDate: string;
  endDate: string;
  pickingEnd: boolean;
  complete: boolean;
};

/**
 * Apply a calendar day click while preserving ISO date strings used across the app.
 */
export function applyRangeDayClick(
  clickedIso: string,
  startDate: string,
  endDate: string,
  pickingEnd: boolean,
  today: string = todayIso(),
): RangeClickResult | null {
  if (!clickedIso || clickedIso < today) return null;

  if (pickingEnd && startDate) {
    if (clickedIso < startDate) return null;
    if (!isValidTripEndDate(startDate, clickedIso, today)) return null;
    return {
      startDate,
      endDate: clickedIso,
      pickingEnd: false,
      complete: true,
    };
  }

  return {
    startDate: clickedIso,
    endDate: clickedIso,
    pickingEnd: true,
    complete: false,
  };
}

export function initialDisplayMonth(startDate: string, today: string = todayIso()): {
  year: number;
  monthIndex: number;
} {
  const anchor = startDate && startDate >= today ? startDate : today;
  const { year, monthIndex } = parseIsoDate(anchor);
  return { year, monthIndex };
}
