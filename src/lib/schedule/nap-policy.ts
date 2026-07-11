import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";

export function hasChildren(plan: TripPlan): boolean {
  return plan.children.length > 0;
}

export function wantsNoNaps(plan: TripPlan): boolean {
  if (!hasChildren(plan)) return true;
  const schedule = plan.napSchedule.trim().toLowerCase();
  return schedule.includes("no nap") || schedule === "no naps needed";
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

/** Resolve nap window from user preference — overrides defaults */
export function getNapWindow(plan: TripPlan): NapWindow | null {
  if (!shouldIncludeNaps(plan)) return null;

  const s = plan.napSchedule.trim().toLowerCase();

  if (s.includes("morning nap") || (s.includes("9") && s.includes("11"))) {
    return { startMin: 9 * 60, endMin: 11 * 60, label: "morning nap window" };
  }
  if (s.includes("afternoon nap") || (s.includes("1") && s.includes("3"))) {
    return { startMin: 13 * 60, endMin: 15 * 60, label: "afternoon nap window" };
  }

  return { startMin: 13 * 60, endMin: 15 * 60, label: "afternoon nap window" };
}

export function napDurationMin(plan: TripPlan): number {
  const window = getNapWindow(plan);
  if (!window) return 75;
  return Math.max(60, window.endMin - window.startMin);
}

export function createNapActivity(plan: TripPlan): RawActivity {
  const window = getNapWindow(plan)!;
  return {
    time: minutesToTime(window.startMin),
    title: window.label.includes("morning") ? "Morning nap & quiet time" : "Afternoon nap & quiet rest",
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

  const insertBefore = withoutNaps.findIndex((a) => parseTimeToMinutes(a.time) > window.startMin);
  const insertAt = insertBefore >= 0 ? insertBefore : withoutNaps.length;

  const result = [...withoutNaps.slice(0, insertAt), nap, ...withoutNaps.slice(insertAt)];
  return result;
}
