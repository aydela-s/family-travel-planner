import type { PlannerEngine } from "@/lib/planning-engine/staged/types";

/**
 * Resolves which itinerary engine to run.
 * Priority: explicit option → PLANNER_ENGINE env → default "staged".
 * Set PLANNER_ENGINE=score (or options.plannerEngine: "score") for the legacy score rollback path.
 */
export function resolvePlannerEngine(option?: PlannerEngine | ""): PlannerEngine {
  if (option === "score" || option === "staged") return option;
  const fromEnv = process.env.PLANNER_ENGINE?.trim().toLowerCase();
  if (fromEnv === "score") return "score";
  if (fromEnv === "staged") return "staged";
  return "staged";
}
