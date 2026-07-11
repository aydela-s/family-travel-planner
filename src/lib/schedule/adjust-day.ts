import { TripPlan } from "@/types/trip-plan";
import { ActivityType } from "@/types/itinerary";

type RawActivity = {
  time: string;
  title: string;
  type: ActivityType;
  notes?: string;
};

function adjustHash(note: string): number {
  return note.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

/** Apply user adjustment note across the full day so changes are visible */
export function applyAdjustmentNote(
  activities: RawActivity[],
  adjustNote: string,
  plan: TripPlan,
): RawActivity[] {
  const note = adjustNote.trim();
  if (!note) return activities;

  const seed = adjustHash(note);
  const lower = note.toLowerCase();

  return activities.map((a, index) => {
    const offset = (seed + index * 17) % 997;
    let title = a.title;
    let notes = a.notes ?? "";

    if (a.type === "activity") {
      if (lower.includes("outdoor") || lower.includes("park")) {
        title = `Outdoor time: ${a.title.replace(/^[^:]+:\s*/, "")}`;
      } else if (lower.includes("museum") || lower.includes("culture")) {
        title = `Museum & culture: ${a.title.replace(/^[^:]+:\s*/, "")}`;
      } else if (lower.includes("slow") || lower.includes("relaxed") || lower.includes("less")) {
        notes = `${notes} Adjusted for a slower pace per your request.`.trim();
      } else {
        title = `${note} — ${a.title}`;
      }
    } else {
      notes = notes ? `${notes} (Adjusted: ${note})` : `Adjusted per your note: ${note}`;
    }

    if (offset % 3 === 0 && a.type === "activity") {
      notes = `${notes} Priority stop #${(offset % 9) + 1} for this adjusted day.`.trim();
    }

    return { ...a, title, notes: notes || undefined };
  });
}

export function adjustmentRevisionKey(activities: RawActivity[]): string {
  return activities.map((a) => `${a.time}|${a.type}|${a.title}|${a.notes ?? ""}`).join(";;");
}

export function dayChanged(
  before: RawActivity[],
  after: RawActivity[],
): boolean {
  return adjustmentRevisionKey(before) !== adjustmentRevisionKey(after);
}
