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
 * Returns `null` when the venue is closed that weekday.
 */
export function hoursForDate(
  landmark: Landmark,
  isoDate?: string,
): LandmarkOpeningHours | null {
  if (!isoDate || !landmark.hoursByWeekday) {
    return landmark.openingHours;
  }
  const weekday = weekdayIndexFromIso(isoDate);
  if (Object.prototype.hasOwnProperty.call(landmark.hoursByWeekday, weekday)) {
    return landmark.hoursByWeekday[weekday] ?? null;
  }
  return landmark.openingHours;
}

export function isLandmarkOpenForVisit(landmark: Landmark, window: VisitWindow): boolean {
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

    const hours = hoursForDate(landmark, visitDate);
    if (!hours) {
      issues.push({
        code: "closed_that_day",
        landmarkName: landmark.name,
        message: `${activity.title} is scheduled on a day ${landmark.name} is closed`,
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

/** Pull landmark name from titles like "Explore Louvre Museum". */
export function extractLandmarkFromTitle(title: string): string | null {
  const cafe = title.match(
    /^(?:Breakfast|Lunch|Dinner) at (.+?)(?:\s+café|\s+cafe)?$/i,
  );
  if (cafe) return cafe[1].trim();

  const match = title.match(
    /^(?:Explore|Visit|Family time at|Outdoor time:|Museum & culture:)\s+(.+)$/i,
  );
  if (match) return match[1].trim();
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
