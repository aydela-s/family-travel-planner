export const NO_NAPS_NEEDED = "No naps needed";

/** Legacy chip values — still accepted by the parser. */
export const napQuickPicks = [
  "Morning nap (~9–11 AM)",
  "Afternoon nap (1–3 PM)",
  NO_NAPS_NEEDED,
] as const;

export type NapQuickPick = (typeof napQuickPicks)[number];

export function isNoNapSelection(napSchedule: string): boolean {
  const s = napSchedule.trim().toLowerCase();
  return s.includes("no nap") || s === "no naps needed";
}

/**
 * Accept free-text windows (e.g. "12-2 PM") or "No naps needed" (FAM-40).
 * Empty string is invalid when the trip has children.
 */
export function isValidNapSelection(napSchedule: string, hasChildren: boolean): boolean {
  if (!hasChildren) return true;
  const s = napSchedule.trim();
  if (!s) return false;
  if (isNoNapSelection(s)) return true;
  if ((napQuickPicks as readonly string[]).includes(s)) return true;
  // Free-text window: needs a start–end time shape (full parse is in nap-policy).
  return /\d{1,2}\s*(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?\s*[-–—to]/i.test(s);
}
