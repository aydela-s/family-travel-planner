import type { PlannerEngine } from "@/lib/planning-engine/staged/types";

/**
 * Resolves which itinerary engine to run.
 * Priority: explicit option → PLANNER_ENGINE env → default "score" (safe rollback).
 */
export function resolvePlannerEngine(option?: PlannerEngine | ""): PlannerEngine {
  if (option === "score" || option === "staged") return option;
  const fromEnv = process.env.PLANNER_ENGINE?.trim().toLowerCase();
  if (fromEnv === "staged") return "staged";
  if (fromEnv === "score") return "score";
  return "score";
}
