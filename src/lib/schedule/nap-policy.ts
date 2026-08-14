import { NapEntry, TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";
import {
  formatMeridiemTime,
  isNoNapsSelection,
  parseMeridiemTime,
  shouldShowNapSection,
} from "@/lib/planning-engine/nap-options";

export function hasChildren(plan: TripPlan): boolean {
  return plan.children.length > 0;
}

export function wantsNoNaps(plan: TripPlan): boolean {
  if (!shouldShowNapSection(plan)) return true;
  if (plan.naps == null) return true;
  return isNoNapsSelection(plan.naps);
}

/** True when at least one regular (stay-home) nap should be scheduled. */
export function shouldIncludeNaps(plan: TripPlan): boolean {
  if (!shouldShowNapSection(plan)) return false;
  if (wantsNoNaps(plan)) return false;
  return (plan.naps ?? []).some((n) => n.type === "regular");
}

/** True when at least one stroller nap window should bias quiet activities. */
export function hasStrollerNaps(plan: TripPlan): boolean {
  if (!shouldShowNapSection(plan)) return false;
  if (wantsNoNaps(plan)) return false;
  return (plan.naps ?? []).some((n) => n.type === "stroller");
}

const NAP_TEXT =
  /\b(nap|naps|naptime|nap time|quiet time for the little ones|return to accommodation|back to the hotel for rest)\b/i;

export function containsNapLanguage(text: string): boolean {
  return NAP_TEXT.test(text);
}

export function stripNapLanguage(text: string): string {
  return text
    .replace(NAP_TEXT, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

type RawActivity = {
  time: string;
  title: string;
  type: ActivityType;
  notes?: string;
};

export function sanitizeActivitiesForNapPolicy(
  activities: RawActivity[],
  plan: TripPlan,
): RawActivity[] {
  if (shouldIncludeNaps(plan)) {
    return activities.map((a) => ({
      ...a,
      title: a.title.trim(),
      notes: a.notes?.trim(),
    }));
  }

  return activities
    .filter((a) => a.type !== "nap")
    .map((a) => {
      const titleHasNap = containsNapLanguage(a.title);
      const notesHasNap = a.notes ? containsNapLanguage(a.notes) : false;
      let type = a.type;
      if (type === "nap" || (type === "rest" && titleHasNap)) {
        type = "rest";
      }
      return {
        ...a,
        type,
        title: titleHasNap ? stripNapLanguage(a.title) || "Midday break" : a.title,
        notes:
          notesHasNap && a.notes
            ? stripNapLanguage(a.notes) || undefined
            : a.notes,
      };
    })
    .filter((a) => !(a.type === "rest" && containsNapLanguage(a.title)));
}

export function napPromptLines(plan: TripPlan): string {
  if (!hasChildren(plan) || !shouldShowNapSection(plan)) {
    return "- No nap windows for this trip — do NOT include naps, nap breaks, or nap-related notes.\n";
  }
  if (wantsNoNaps(plan)) {
    return "- CRITICAL: User chose NO NAPS — never schedule nap blocks, quiet nap time, or returning to accommodation for naps.\n";
  }
  const regular = getRegularNapWindows(plan);
  const stroller = getStrollerNapWindows(plan);
  const lines: string[] = [];
  for (const w of regular) {
    lines.push(
      `- Regular nap: schedule stay-home nap ONLY during ${w.label} (${minutesToTime(w.startMin)}–${minutesToTime(w.endMin)}).`,
    );
  }
  for (const w of stroller) {
    lines.push(
      `- Stroller nap ${w.label} (${minutesToTime(w.startMin)}–${minutesToTime(w.endMin)}): prefer quiet, low-intensity stops; do not force return to stay.`,
    );
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "- Include age-appropriate rest periods.\n";
}

export type NapWindow = {
  startMin: number;
  endMin: number;
  label: string;
  type: "regular" | "stroller";
};

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 12) * 60 + (m ?? 0);
}

function windowFromEntry(entry: NapEntry): NapWindow | null {
  const startMin = parseMeridiemTime(entry.startTime);
  const endMin = parseMeridiemTime(entry.endTime);
  if (startMin == null || endMin == null || endMin <= startMin) return null;
  const label =
    startMin < 12 * 60
      ? `${entry.type} morning nap window`
      : `${entry.type} afternoon nap window`;
  return { startMin, endMin, label, type: entry.type };
}

export function getResolvedNapWindows(plan: TripPlan): NapWindow[] {
  if (!shouldShowNapSection(plan) || wantsNoNaps(plan) || !plan.naps) return [];
  return plan.naps
    .map(windowFromEntry)
    .filter((w): w is NapWindow => w != null)
    .sort((a, b) => a.startMin - b.startMin);
}

export function getRegularNapWindows(plan: TripPlan): NapWindow[] {
  return getResolvedNapWindows(plan).filter((w) => w.type === "regular");
}

export function getStrollerNapWindows(plan: TripPlan): NapWindow[] {
  return getResolvedNapWindows(plan).filter((w) => w.type === "stroller");
}

/**
 * Primary regular nap window (earliest) — used for lunch-before-nap and single-window helpers.
 * Stroller-only plans return null (no stay-home nap block).
 */
export function getNapWindow(plan: TripPlan): NapWindow | null {
  if (!shouldIncludeNaps(plan)) return null;
  return getRegularNapWindows(plan)[0] ?? null;
}

/** True when a visit window overlaps any stroller nap (FAM-52). */
export function overlapsStrollerNap(
  plan: TripPlan,
  visitStartMin: number,
  visitEndMin: number,
): boolean {
  return getStrollerNapWindows(plan).some(
    (w) => visitStartMin < w.endMin && visitEndMin > w.startMin,
  );
}

export function napDurationMin(plan: TripPlan, window?: NapWindow | null): number {
  const w = window === undefined ? getNapWindow(plan) : window;
  if (!w) return 75;
  const span = w.endMin - w.startMin;
  return Math.min(180, Math.max(45, span));
}

export function createNapActivity(window: NapWindow): RawActivity {
  return {
    time: minutesToTime(window.startMin),
    title: "Nap & Quiet Time",
    type: "nap",
  };
}

/** Insert stay-home nap blocks for each regular nap window (FAM-52). */
export function applyNapTiming(activities: RawActivity[], plan: TripPlan): RawActivity[] {
  if (!shouldIncludeNaps(plan)) {
    return sanitizeActivitiesForNapPolicy(activities, plan);
  }

  const windows = getRegularNapWindows(plan);
  if (windows.length === 0) return activities;

  let withoutNaps = activities.filter((a) => a.type !== "nap");

  for (const window of windows) {
    const nap = createNapActivity(window);
    let insertAt = withoutNaps.findIndex((a) => parseTimeToMinutes(a.time) > window.startMin);
    if (insertAt < 0) insertAt = withoutNaps.length;

    // Midday/afternoon naps belong after lunch when lunch would otherwise land after nap start.
    if (window.startMin >= 11 * 60 + 30) {
      const lunchIdx = withoutNaps.findIndex((a) => {
        if (a.type !== "meal") return false;
        const title = a.title.toLowerCase();
        return !title.includes("breakfast") && !title.includes("dinner");
      });
      if (lunchIdx >= 0) {
        insertAt = Math.max(insertAt, lunchIdx + 1);
      }
    }

    withoutNaps = [
      ...withoutNaps.slice(0, insertAt),
      nap,
      ...withoutNaps.slice(insertAt),
    ];
  }

  return withoutNaps;
}
