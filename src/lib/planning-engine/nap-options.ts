export const napQuickPicks = [
  "Morning nap (~9–11 AM)",
  "Afternoon nap (1–3 PM)",
  "No naps needed",
] as const;

export type NapQuickPick = (typeof napQuickPicks)[number];

export function isValidNapSelection(napSchedule: string, hasChildren: boolean): boolean {
  if (!hasChildren) return true;
  return napQuickPicks.includes(napSchedule as NapQuickPick);
}
