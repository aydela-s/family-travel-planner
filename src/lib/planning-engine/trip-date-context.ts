import { getTripDayCount } from "@/lib/itinerary";

export type TripDateContext = {
  dayCount: number;
  weekendDays: number;
  includesWeekend: boolean;
  weekdayOnly: boolean;
};

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Every calendar date in the trip, inclusive of start and end. */
export function eachTripDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
  }

  return dates;
}

export function isWeekendDate(isoDate: string): boolean {
  const day = parseIsoDate(isoDate).getDay();
  return day === 0 || day === 6;
}

export function getTripDateContext(startDate: string, endDate: string): TripDateContext | null {
  const dayCount = getTripDayCount(startDate, endDate);
  if (dayCount <= 0) return null;

  const weekendDays = eachTripDate(startDate, endDate).filter(isWeekendDate).length;
  const includesWeekend = weekendDays > 0;

  return {
    dayCount,
    weekendDays,
    includesWeekend,
    weekdayOnly: !includesWeekend,
  };
}

/** User-facing hint on the Dates wizard step — uses real calendar weekdays, not just day count. */
export function tripLengthHint(context: TripDateContext): string {
  const { dayCount, includesWeekend } = context;

  if (dayCount === 1) {
    return "A day trip — we'll pack in the highlights without rushing.";
  }
  if (dayCount >= 14) {
    return `${dayCount} days — about two weeks; we'll help you pace it so nobody burns out.`;
  }
  if (dayCount <= 3 && includesWeekend) {
    return `${dayCount} days — perfect for a long weekend.`;
  }
  if (dayCount <= 3) {
    return `${dayCount} days — a short midweek getaway with a focused plan.`;
  }
  if (dayCount <= 7) {
    return `${dayCount} days gives you room to explore at a family-friendly pace.`;
  }
  return `${dayCount} days — we'll help you pace it so nobody burns out.`;
}
