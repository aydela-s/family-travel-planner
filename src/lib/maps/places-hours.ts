import {
  HoursByWeekday,
  Landmark,
  LandmarkOpeningHours,
} from "@/config/city-pricing";

/** Google Places period slice (hours are 0–23, minutes 0–59). */
export type PlacesHoursPeriod = {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

/** Places API (New) `regularOpeningHours` shape (Text Search / Details). */
export type PlacesRegularOpeningHours = {
  periods?: Array<{
    open?: { day?: number; hour?: number; minute?: number };
    close?: { day?: number; hour?: number; minute?: number };
  }>;
};

function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Normalize Places regularOpeningHours.periods into our period type. */
export function placesHoursPeriodsFromRegularOpeningHours(
  regularOpeningHours: PlacesRegularOpeningHours | undefined | null,
): PlacesHoursPeriod[] {
  const periods: PlacesHoursPeriod[] = [];
  for (const period of regularOpeningHours?.periods ?? []) {
    const openDay = period.open?.day;
    const openHour = period.open?.hour;
    const openMinute = period.open?.minute ?? 0;
    if (typeof openDay !== "number" || typeof openHour !== "number") continue;
    const mapped: PlacesHoursPeriod = {
      open: { day: openDay, hour: openHour, minute: openMinute },
    };
    if (
      period.close &&
      typeof period.close.day === "number" &&
      typeof period.close.hour === "number"
    ) {
      mapped.close = {
        day: period.close.day,
        hour: period.close.hour,
        minute: period.close.minute ?? 0,
      };
    }
    periods.push(mapped);
  }
  return periods;
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

/** Text Search / Details `regularOpeningHours` → hoursByWeekday (FAM-66). */
export function hoursByWeekdayFromRegularOpeningHours(
  regularOpeningHours: PlacesRegularOpeningHours | undefined | null,
): HoursByWeekday | undefined {
  return hoursByWeekdayFromPlacesPeriods(
    placesHoursPeriodsFromRegularOpeningHours(regularOpeningHours),
  );
}

/** First non-null open window — used as `openingHours` fallback when Places sets weekday hours. */
export function typicalOpeningHoursFromWeekday(
  schedule: HoursByWeekday | undefined,
): LandmarkOpeningHours | undefined {
  if (!schedule) return undefined;
  for (const day of [1, 2, 3, 4, 5, 6, 0] as const) {
    const hours = schedule[day];
    if (hours) return hours;
  }
  return undefined;
}

/**
 * Prefer curated / existing weekday hours; fill only missing weekday keys from Places.
 */
export function mergeHoursByWeekdayPreferExisting(
  existing: HoursByWeekday | undefined,
  fromPlaces: HoursByWeekday | undefined,
): HoursByWeekday | undefined {
  if (!fromPlaces) return existing;
  if (!existing) return fromPlaces;

  const out: HoursByWeekday = { ...fromPlaces };
  for (const day of [0, 1, 2, 3, 4, 5, 6] as const) {
    if (Object.prototype.hasOwnProperty.call(existing, day)) {
      out[day] = existing[day];
    }
  }
  return out;
}

/** Stamp Places weekday hours onto a landmark without clobbering curated days. */
export function applyPlacesHoursToLandmark(
  landmark: Landmark,
  fromPlaces: HoursByWeekday | undefined,
): Landmark {
  if (!fromPlaces) return landmark;
  const hoursByWeekday = mergeHoursByWeekdayPreferExisting(
    landmark.hoursByWeekday,
    fromPlaces,
  );
  if (!hoursByWeekday) return landmark;
  const typical = typicalOpeningHoursFromWeekday(hoursByWeekday);
  return {
    ...landmark,
    hoursByWeekday,
    // Keep curated openingHours when weekday table already existed; otherwise adopt Places typical.
    openingHours:
      landmark.hoursByWeekday != null
        ? landmark.openingHours
        : (typical ?? landmark.openingHours),
  };
}

/** Google Place ids from Places (New) — skip local catalog short ids. */
export function isGooglePlaceId(placeId: string | undefined | null): boolean {
  if (!placeId?.trim()) return false;
  const id = placeId.trim();
  if (id.startsWith("ChIJ")) return true;
  if (id.startsWith("places/")) return true;
  // Places (New) resource ids are longer than local catalog keys like "dallas".
  return id.length >= 20;
}
