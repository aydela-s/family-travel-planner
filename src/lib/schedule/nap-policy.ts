import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";
import { isNoNapSelection } from "@/lib/planning-engine/nap-options";

export function hasChildren(plan: TripPlan): boolean {
  return plan.children.length > 0;
}

export function wantsNoNaps(plan: TripPlan): boolean {
  if (!hasChildren(plan)) return true;
  return isNoNapSelection(plan.napSchedule);
}

/** True only when children exist AND user wants nap/rest periods in the plan */
export function shouldIncludeNaps(plan: TripPlan): boolean {
  if (!hasChildren(plan)) return false;
  if (wantsNoNaps(plan)) return false;
  if (plan.napSchedule.trim()) return true;
  return plan.children.some((age) => age <= 5);
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
  if (!hasChildren(plan)) {
    return "- No children traveling — do NOT include naps, nap breaks, or nap-related notes.\n";
  }
  if (wantsNoNaps(plan)) {
    return "- CRITICAL: User chose NO NAPS — never schedule nap blocks, quiet nap time, or returning to accommodation for naps.\n";
  }
  const window = getNapWindow(plan);
  if (window) {
    return `- Nap preference: ${plan.napSchedule}. Schedule nap ONLY during ${window.label} (${minutesToTime(window.startMin)}–${minutesToTime(window.endMin)}).\n`;
  }
  return `- Nap preference: ${plan.napSchedule || "flexible — include age-appropriate rest periods"}.\n`;
}

export type NapWindow = {
  startMin: number;
  endMin: number;
  label: string;
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 12) * 60 + (m ?? 0);
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function meridiemToMinutes(
  hour: number,
  minute: number,
  meridiem: string | undefined,
): number {
  let h = hour;
  const mer = meridiem?.replace(/\./g, "").toLowerCase();
  if (mer?.startsWith("p") && h < 12) h += 12;
  if (mer?.startsWith("a") && h === 12) h = 0;
  return h * 60 + minute;
}

/**
 * Parse free-text nap windows like "12-2 PM", "12:00-14:00", "1–3 PM" (FAM-40).
 * Returns null when the text can't be interpreted as a time range.
 */
export function parseNapWindow(text: string): NapWindow | null {
  const s = text.trim().toLowerCase();
  if (!s || isNoNapSelection(s)) return null;

  // Legacy chip / test labels
  if (s.includes("morning nap") || (s.includes("~9") && s.includes("11"))) {
    return { startMin: 9 * 60, endMin: 11 * 60, label: "morning nap window" };
  }
  if (
    (s.includes("afternoon nap") || s.includes("early afternoon")) &&
    s.includes("1") &&
    s.includes("3")
  ) {
    return { startMin: 13 * 60, endMin: 15 * 60, label: "afternoon nap window" };
  }

  const range = s.match(
    /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:[-–—]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
  );
  if (!range) return null;

  const h1 = Number(range[1]);
  const m1 = Number(range[2] ?? "0");
  let mer1 = range[3];
  const h2 = Number(range[4]);
  const m2 = Number(range[5] ?? "0");
  let mer2 = range[6];

  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;

  // 24h style: "13:00-15:00" / "12:00-14:00" — only when an hour is clearly > 12.
  // Do NOT treat "11:30-1:30" as 24h just because minutes are present (that broke
  // cross-noon windows and fell back to the default 1–3 PM slot).
  if (!mer1 && !mer2 && (h1 > 12 || h2 > 12)) {
    const startMin = h1 * 60 + m1;
    const endMin = h2 * 60 + m2;
    if (endMin <= startMin) return null;
    const label = startMin < 12 * 60 ? "morning nap window" : "afternoon nap window";
    return { startMin, endMin, label };
  }

  if (!mer1 && mer2) mer1 = mer2;
  if (!mer2 && mer1) mer2 = mer1;
  if (!mer1 && !mer2) {
    // Bare "9-11" / "9:00-11:00" → AM; bare "1-3" / "11:30-1:30" / "12-2" → PM span
    if (h1 <= 11 && h2 <= 11 && h1 < h2 && h1 >= 7 && h2 <= 11) {
      mer1 = "am";
      mer2 = "am";
    } else {
      mer1 = "pm";
      mer2 = "pm";
    }
  }

  let startMin = meridiemToMinutes(h1, m1, mer1);
  let endMin = meridiemToMinutes(h2, m2, mer2);

  // "11:30-1:30" / "9-2 PM" → start is morning when end would otherwise precede start
  if (
    endMin <= startMin &&
    h1 <= 11 &&
    (h2 < h1 || h2 <= 6) &&
    (mer2?.replace(/\./g, "").toLowerCase().startsWith("p") || !range[6])
  ) {
    startMin = meridiemToMinutes(h1, m1, "am");
    if (!mer2 || mer2.replace(/\./g, "").toLowerCase().startsWith("p")) {
      endMin = meridiemToMinutes(h2, m2, "pm");
    }
  }

  if (endMin <= startMin) return null;

  const label = startMin < 12 * 60 ? "morning nap window" : "afternoon nap window";
  return { startMin, endMin, label };
}

/** Resolve nap window from user preference — overrides defaults */
export function getNapWindow(plan: TripPlan): NapWindow | null {
  if (!shouldIncludeNaps(plan)) return null;

  const parsed = parseNapWindow(plan.napSchedule);
  if (parsed) return parsed;

  // Fallback when text is free-form but has no parseable range
  return { startMin: 13 * 60, endMin: 15 * 60, label: "afternoon nap window" };
}

export function napDurationMin(plan: TripPlan): number {
  const window = getNapWindow(plan);
  if (!window) return 75;
  // Honor the typed window end-to-end. Only clamp extreme free-text spans
  // (e.g. "9 AM–6 PM") so a nap can't swallow the whole day.
  const span = window.endMin - window.startMin;
  return Math.min(180, Math.max(45, span));
}

export function createNapActivity(plan: TripPlan): RawActivity {
  const window = getNapWindow(plan)!;
  return {
    time: minutesToTime(window.startMin),
    title: "Nap & Quiet Time",
    type: "nap",
    notes: plan.napSchedule || "Protected downtime per your nap preference.",
  };
}

export function applyNapTiming(activities: RawActivity[], plan: TripPlan): RawActivity[] {
  if (!shouldIncludeNaps(plan)) {
    return sanitizeActivitiesForNapPolicy(activities, plan);
  }

  const window = getNapWindow(plan);
  if (!window) return activities;

  const withoutNaps = activities.filter((a) => a.type !== "nap");
  const nap = createNapActivity(plan);

  let insertAt = withoutNaps.findIndex((a) => parseTimeToMinutes(a.time) > window.startMin);
  if (insertAt < 0) insertAt = withoutNaps.length;

  // Midday/afternoon naps belong after lunch. Lunch often defaults to 12:30 while a
  // typed "12-2" nap starts at 12:00 — inserting by clock alone put the nap before
  // lunch and caused overlaps once times were resolved.
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

  return [...withoutNaps.slice(0, insertAt), nap, ...withoutNaps.slice(insertAt)];
}
