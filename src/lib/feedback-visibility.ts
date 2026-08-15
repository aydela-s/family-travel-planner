/** FAM-79 — floating feedback is for the planner result, not wizard steps. */
export function shouldAllowFeedbackLauncher(hasItinerary: boolean): boolean {
  return hasItinerary;
}
