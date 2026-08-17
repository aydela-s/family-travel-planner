import {
  HoursByWeekday,
  Landmark,
  LandmarkOpeningHours,
} from "@/config/city-pricing";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { ActivityType } from "@/types/itinerary";

export type OpeningHoursViolation = {
  code: "outside_opening_hours" | "closed_that_day";
  message: string;
  landmarkName: string;
  /**
   * True when the hours behind this violation are real venue data (curated or
   * Places weekday schedule). Assumed category hours produce a soft
   * confirm-hours note instead of a hard failure.
   */
  hoursReliable: boolean;
};

/**
 * Anything with hours we can reason about: curated landmarks, Places-backed
 * landmarks, and restaurants (which may have no hours at all).
 */
export type VenueHours = {
  openingHours?: LandmarkOpeningHours;
  hoursByWeekday?: HoursByWeekday;
  hoursConfidence?: "assumed";
};

type TimedActivity = {
  time: string;
  endTime?: string;
  title: string;
  type: ActivityType;
  location?: { name: string };
};

/** Planned visit window used when preferring open landmarks. */
export type VisitWindow = {
  startMin: number;
  endMin: number;
  /** ISO date YYYY-MM-DD for weekday closed-day checks. */
  visitDate?: string;
};

/** True when [start, end] fits entirely inside the landmark's open window. */
export function isWithinOpeningHours(
  startMin: number,
  endMin: number,
  hours: LandmarkOpeningHours,
): boolean {
  const open = parseTimeToMinutes(hours.open);
  const close = parseTimeToMinutes(hours.close);
  return startMin >= open && endMin <= close;
}

/** Weekday index for an ISO date (local noon to avoid TZ edge cases). */
export function weekdayIndexFromIso(isoDate: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return day as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Hours for a calendar date.
 * Returns `null` when the venue is closed that weekday, `undefined` when the
 * venue publishes no hours at all.
 */
export function hoursForDate(
  venue: VenueHours,
  isoDate?: string,
): LandmarkOpeningHours | null | undefined {
  if (!isoDate || !venue.hoursByWeekday) {
    return venue.openingHours;
  }
  const weekday = weekdayIndexFromIso(isoDate);
  if (Object.prototype.hasOwnProperty.call(venue.hoursByWeekday, weekday)) {
    return venue.hoursByWeekday[weekday] ?? null;
  }
  return venue.openingHours;
}

/**
 * True when the hours on this venue are real data we may act on: a weekday
 * schedule (curated or Places `regularOpeningHours`), or curated `openingHours`.
 * Category guesses (`hoursConfidence: "assumed"`) and missing hours are not.
 */
export function hoursAreReliable(venue: VenueHours): boolean {
  if (venue.hoursByWeekday && Object.keys(venue.hoursByWeekday).length > 0) return true;
  return Boolean(venue.openingHours) && venue.hoursConfidence !== "assumed";
}

/** Any part of the planned visit falls inside the open window. */
export function overlapsOpeningHours(
  startMin: number,
  endMin: number,
  hours: LandmarkOpeningHours,
): boolean {
  const open = parseTimeToMinutes(hours.open);
  const close = parseTimeToMinutes(hours.close);
  return startMin < close && endMin > open;
}

/**
 * HARD RULE input: reliable hours say the venue is shut for the whole planned
 * slot — closed that weekday, or open at a completely different time of day
 * (an evening-only venue against a morning visit).
 *
 * A visit that merely starts a few minutes early or runs past closing is NOT
 * hard-excluded: planning windows are estimates the scheduler still shifts, and
 * the soft `isLandmarkOpenForVisit` preference plus the confirm-hours note
 * already cover that case.
 */
export function isKnownClosedForVisit(venue: VenueHours, window: VisitWindow): boolean {
  if (!hoursAreReliable(venue)) return false;
  const hours = hoursForDate(venue, window.visitDate);
  if (hours === null) return true;
  if (!hours) return false;
  return !overlapsOpeningHours(window.startMin, window.endMin, hours);
}

/** Soft preference: the whole planned visit fits inside the open window. */
export function isLandmarkOpenForVisit(landmark: VenueHours, window: VisitWindow): boolean {
  const hours = hoursForDate(landmark, window.visitDate);
  if (!hours) return false;
  return isWithinOpeningHours(window.startMin, window.endMin, hours);
}

export function findLandmarkByName(
  landmarks: Landmark[],
  name: string,
): Landmark | undefined {
  const needle = name.trim().toLowerCase();
  return landmarks.find(
    (l) =>
      l.name.toLowerCase() === needle ||
      needle.includes(l.name.toLowerCase()) ||
      l.name.toLowerCase().includes(needle),
  );
}

/**
 * Soft check — flags activities scheduled outside landmark hours.
 * Does not remove or reschedule; callers log or surface warnings.
 */
export function validateActivityOpeningHours(
  activities: TimedActivity[],
  landmarks: Landmark[],
  defaultDurationMin: (a: TimedActivity) => number,
  visitDate?: string,
): OpeningHoursViolation[] {
  const issues: OpeningHoursViolation[] = [];

  for (const activity of activities) {
    if (activity.type !== "activity") continue;

    const landmarkName = activity.location?.name ?? extractLandmarkFromTitle(activity.title);
    if (!landmarkName) continue;

    const landmark = findLandmarkByName(landmarks, landmarkName);
    if (!landmark) continue;

    const reliable = hoursAreReliable(landmark);
    const hours = hoursForDate(landmark, visitDate);
    if (!hours) {
      issues.push({
        code: "closed_that_day",
        landmarkName: landmark.name,
        message: `${activity.title} is scheduled on a day ${landmark.name} is closed`,
        hoursReliable: reliable,
      });
      continue;
    }

    const start = parseTimeToMinutes(activity.time);
    const end = activity.endTime
      ? parseTimeToMinutes(activity.endTime)
      : start + defaultDurationMin(activity);

    if (!isWithinOpeningHours(start, end, hours)) {
      issues.push({
        code: "outside_opening_hours",
        landmarkName: landmark.name,
        message: `${activity.title} (${activity.time}–${formatEnd(end)}) is outside ${landmark.name} hours (${hours.open}–${hours.close})`,
        // Same bar as selection: a slot with no overlap at all is a hard
        // failure; an early arrival or an overrun stays advisory.
        hoursReliable: reliable && !overlapsOpeningHours(start, end, hours),
      });
    }
  }

  return issues;
}

function formatEnd(endMin: number): string {
  const h = Math.floor(endMin / 60);
  const m = endMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Pull landmark name from titles like "Explore Louvre Museum" or "… near Belmont Park". */
export function extractLandmarkFromTitle(title: string): string | null {
  const cafe = title.match(
    /^(?:Breakfast|Lunch|Dinner) at (.+?)(?:\s+café|\s+cafe)?$/i,
  );
  if (cafe) return cafe[1].trim();

  const match = title.match(
    /^(?:Explore|Visit|Family time at|Outdoor time:|Museum & culture:)\s+(.+)$/i,
  );
  if (match) return match[1].trim();

  // Meal / rest copy: "Breakfast near Fleet Science Center" / "Lunch near Belmont Park"
  const near = title.match(/\bnear\s+(.+)$/i);
  if (near) return near[1].trim();

  // Soft stops: "Break at Belmont Park", "Quiet time at your hotel" (hotel is stay — ok to extract)
  const atPlace = title.match(
    /\b(?:break|stroll|quiet time|pack up(?:\s*&\s*unwind)?|calm family time)\s+at\s+(.+)$/i,
  );
  if (atPlace) return atPlace[1].trim();

  // Fallback: strip a leading "Something: " prefix from adjust actions.
  const colon = title.match(/^[^:]+:\s*(.+)$/);
  if (colon && colon[1].length > 3) return colon[1].trim();
  return null;
}

/** Build a full-week schedule from typical hours + closed weekdays. */
export function hoursByWeekdayWithClosedDays(
  typical: LandmarkOpeningHours,
  closedWeekdays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>,
): HoursByWeekday {
  const schedule: HoursByWeekday = {};
  for (const day of closedWeekdays) {
    schedule[day] = null;
  }
  // Ensure typical is used for other days via fallback; only store closed explicitly.
  void typical;
  return schedule;
}
