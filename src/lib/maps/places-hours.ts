/**
 * Map Google Place Details opening_hours.periods into our hoursByWeekday model.
 * Used once Places POI enrichment lands (FAM Places hours slice).
 */

import { HoursByWeekday, LandmarkOpeningHours } from "@/config/city-pricing";

/** Google Places period slice (hours are 0–23, minutes 0–59). */
export type PlacesHoursPeriod = {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Convert Places periods to hoursByWeekday.
 * Days with no open period are marked closed (`null`).
 */
export function hoursByWeekdayFromPlacesPeriods(
  periods: PlacesHoursPeriod[] | undefined,
): HoursByWeekday | undefined {
  if (!periods || periods.length === 0) return undefined;

  const schedule: HoursByWeekday = {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };

  for (const period of periods) {
    const day = period.open.day as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    if (day < 0 || day > 6) continue;
    if (!period.close) {
      // Open 24 hours that day
      schedule[day] = { open: "00:00", close: "23:59" };
      continue;
    }
    const hours: LandmarkOpeningHours = {
      open: formatHm(period.open.hour, period.open.minute),
      close: formatHm(period.close.hour, period.close.minute),
    };
    schedule[day] = hours;
  }

  return schedule;
}
