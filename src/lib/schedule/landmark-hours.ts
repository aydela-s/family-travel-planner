import { Landmark, LandmarkOpeningHours } from "@/config/city-pricing";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { ActivityType } from "@/types/itinerary";

export type OpeningHoursViolation = {
  code: "outside_opening_hours";
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

export function isLandmarkOpenForVisit(landmark: Landmark, window: VisitWindow): boolean {
  return isWithinOpeningHours(window.startMin, window.endMin, landmark.openingHours);
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
): OpeningHoursViolation[] {
  const issues: OpeningHoursViolation[] = [];

  for (const activity of activities) {
    if (activity.type !== "activity") continue;

    const landmarkName = activity.location?.name ?? extractLandmarkFromTitle(activity.title);
    if (!landmarkName) continue;

    const landmark = findLandmarkByName(landmarks, landmarkName);
    if (!landmark) continue;

    const start = parseTimeToMinutes(activity.time);
    const end = activity.endTime
      ? parseTimeToMinutes(activity.endTime)
      : start + defaultDurationMin(activity);

    if (!isWithinOpeningHours(start, end, landmark.openingHours)) {
      issues.push({
        code: "outside_opening_hours",
        landmarkName: landmark.name,
        message: `${activity.title} (${activity.time}–${formatEnd(end)}) is outside ${landmark.name} hours (${landmark.openingHours.open}–${landmark.openingHours.close})`,
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
  const match = title.match(
    /^(?:Explore|Visit|Family time at|Outdoor time:|Museum & culture:)\s+(.+)$/i,
  );
  if (match) return match[1].trim();
  // Fallback: strip a leading "Something: " prefix from adjust actions.
  const colon = title.match(/^[^:]+:\s*(.+)$/);
  if (colon && colon[1].length > 3) return colon[1].trim();
  return null;
}
