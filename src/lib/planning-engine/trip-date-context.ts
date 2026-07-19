import { getTripDayCount } from "@/lib/itinerary";

/** Inclusive list of ISO dates from start through end. */
export function eachTripDate(startIso: string, endIso: string): string[] {
  const days = getTripDayCount(startIso, endIso);
  const dates: string[] = [];
  const start = new Date(`${startIso}T12:00:00`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function isWeekendDate(isoDate: string): boolean {
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

export type TripDateContext = {
  dayCount: number;
  includesWeekend: boolean;
  allWeekdays: boolean;
};

export function getTripDateContext(startIso: string, endIso: string): TripDateContext | null {
  if (!startIso || !endIso) return null;
  const dates = eachTripDate(startIso, endIso);
  const includesWeekend = dates.some(isWeekendDate);
  return {
    dayCount: dates.length,
    includesWeekend,
    allWeekdays: !includesWeekend,
  };
}

/** Wizard hint for trip length — never claims “long weekend” on weekdays (FAM-9). */
export function tripLengthHint(startIso: string, endIso: string): string | null {
  const ctx = getTripDateContext(startIso, endIso);
  if (!ctx) return null;

  const { dayCount, includesWeekend, allWeekdays } = ctx;

  if (dayCount === 1) {
    return includesWeekend
      ? "One day — a focused weekend outing."
      : "One day — a focused midweek outing.";
  }

  if (dayCount <= 3) {
    if (includesWeekend) {
      return `${dayCount} days — perfect for a long weekend.`;
    }
    if (allWeekdays) {
      return `${dayCount} days — a short midweek getaway.`;
    }
  }

  if (dayCount <= 5) {
    return `${dayCount} days — enough time for a well-paced trip.`;
  }

  return `${dayCount} days — room to settle in and explore.`;
}
