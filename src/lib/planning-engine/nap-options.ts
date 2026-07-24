import { NapEntry, NapType, TripPlan } from "@/types/trip-plan";

/** Youngest child older than this → hide nap UI (FAM-52). Ages 0–6 inclusive; hide from 7+. */
export const NAP_AGE_MAX = 6;

export const MAX_NAPS = 3;

export const DEFAULT_NAP_ENTRY: NapEntry = {
  startTime: "12:00 PM",
  endTime: "2:00 PM",
  type: "regular",
};

/** 30-minute steps from 7:00 AM through 7:00 PM (12-hour labels). */
export const NAP_TIME_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let min = 7 * 60; min <= 19 * 60; min += 30) {
    options.push(formatMeridiemTime(min));
  }
  return options;
})();

export function formatMeridiemTime(totalMinutes: number): string {
  const clamped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${meridiem}`;
}

/**
 * Parse "12:00 PM" / "9:30 AM" (and a few loose variants) into minutes from midnight.
 * Returns null when the string is not a usable clock time.
 */
export function parseMeridiemTime(text: string): number | null {
  const s = text.trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const mer = m[3].replace(/\./g, "").toLowerCase();
  if (mer.startsWith("p") && hour < 12) hour += 12;
  if (mer.startsWith("a") && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function napEntry(
  startTime: string,
  endTime: string,
  type: NapType = "regular",
): NapEntry {
  return { startTime, endTime, type };
}

/** True when the wizard should show the nap scheduler (FAM-52 §7). */
export function shouldShowNapSection(plan: Pick<TripPlan, "children">): boolean {
  if (plan.children.length === 0) return false;
  const youngest = Math.min(...plan.children);
  return youngest <= NAP_AGE_MAX;
}

export function isNoNapsSelection(naps: NapEntry[] | null | undefined): boolean {
  return Array.isArray(naps) && naps.length === 0;
}

export function napEntryError(entry: NapEntry): string | null {
  const start = parseMeridiemTime(entry.startTime);
  const end = parseMeridiemTime(entry.endTime);
  if (start == null || end == null) return "Choose a valid start and end time.";
  if (start >= end) return "Start time must be before end time.";
  return null;
}

export function napsOverlap(a: NapEntry, b: NapEntry): boolean {
  const aStart = parseMeridiemTime(a.startTime);
  const aEnd = parseMeridiemTime(a.endTime);
  const bStart = parseMeridiemTime(b.startTime);
  const bEnd = parseMeridiemTime(b.endTime);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function validateNapsList(naps: NapEntry[]): string | null {
  if (naps.length > MAX_NAPS) return `You can add up to ${MAX_NAPS} naps.`;
  for (let i = 0; i < naps.length; i++) {
    const err = napEntryError(naps[i]!);
    if (err) return `Nap #${i + 1}: ${err}`;
  }
  for (let i = 0; i < naps.length; i++) {
    for (let j = i + 1; j < naps.length; j++) {
      if (napsOverlap(naps[i]!, naps[j]!)) {
        return `Nap #${i + 1} and Nap #${j + 1} overlap.`;
      }
    }
  }
  return null;
}

/**
 * Wizard / planner gate (FAM-52).
 * Hidden section → always valid. Shown → must answer (null invalid); [] or valid list OK.
 */
export function isValidNapSelection(
  naps: NapEntry[] | null | undefined,
  plan: Pick<TripPlan, "children">,
): boolean {
  if (!shouldShowNapSection(plan)) return true;
  if (naps == null) return false;
  if (naps.length === 0) return true;
  return validateNapsList(naps) === null;
}

export function formatNapsSummary(naps: NapEntry[] | null | undefined): string {
  if (naps == null) return "Not set";
  if (naps.length === 0) return "No naps needed";
  return naps
    .map((n) => {
      const kind = n.type === "stroller" ? "stroller" : "regular";
      return `${n.startTime}–${n.endTime} (${kind})`;
    })
    .join("; ");
}
