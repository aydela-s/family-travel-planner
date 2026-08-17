export { resolvePlannerEngine } from "@/lib/planning-engine/staged/engine-flag";
export { createEmptyBlueprint, emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
export {
  buildExperienceCoverageTargets,
  markExperienceCompleted,
  markExperienceCompletedByKeys,
  remainingExperiences,
  targetForInterest,
} from "@/lib/planning-engine/staged/experience-coverage";
export {
  isIndoorPlayExperience,
  isOutdoorPlayground,
  isShorelineBeachExperience,
  LOW_FRICTION_PREFERRED_KM,
  LOW_FRICTION_STAY_KM,
} from "@/lib/planning-engine/staged/landmark-experience";
export {
  activityTitlesByDay,
  fingerprintRawItinerary,
  type ItineraryFingerprint,
} from "@/lib/planning-engine/staged/fingerprint";
export {
  assignDayRoles,
  buildTripStrategy,
  goalsAndConstraintsForRole,
} from "@/lib/planning-engine/staged/strategy-builder";
export { THEME_CATALOG, themeById, themeGoalsAndConstraints } from "@/lib/planning-engine/staged/theme-catalog";
export {
  applyDailyThemes,
  budgetIntentForFullDay,
  eligibleInterestThemes,
  scoreTheme,
} from "@/lib/planning-engine/staged/theme-generator";
export {
  filterAnchorCandidates,
  scoreAnchorCandidate,
  selectAnchorForDay,
  selectSoftFiller,
  toCommittedStop,
} from "@/lib/planning-engine/staged/anchor-selector";
export { selectSupportForDay, scoreSupportCandidate } from "@/lib/planning-engine/staged/support-selector";
export {
  commitStopsToBlueprint,
  placementFromDayBlueprint,
  type StagedDayPlacement,
} from "@/lib/planning-engine/staged/fill-stops";
export {
  planMealsOnBlueprint,
  planMealsForDay,
  labelForMealIntent,
} from "@/lib/planning-engine/staged/meal-planner";
export {
  buildScheduleFromBlueprint,
  type StagedDaySchedule,
} from "@/lib/planning-engine/staged/schedule-builder";
export { validateBlueprint } from "@/lib/planning-engine/staged/validate-blueprint";
export {
  repairBlueprint,
  validateAndRepairBlueprint,
} from "@/lib/planning-engine/staged/repair-blueprint";
export {
  isEligibleStop,
  stopRejection,
  violatesAgeRestriction,
} from "@/lib/planning-engine/staged/eligibility";
export {
  anchorVisitWindow,
  supportVisitWindow,
  mealVisitWindow,
} from "@/lib/planning-engine/staged/visit-windows";
export {
  TRIP_BLUEPRINT_VERSION,
  type CommittedStop,
  type DayBlueprint,
  type DayBudgetIntent,
  type DayConstraint,
  type DayGoal,
  type DayRole,
  type DayTheme,
  type ExperienceCoverage,
  type ExperienceCoverageItem,
  type MealFormality,
  type MealIntent,
  type MealSlotKind,
  type PlannerEngine,
  type PlanningRules,
  type ThemeId,
  type TripBlueprint,
  type TripLedger,
  type ValidationViolation,
} from "@/lib/planning-engine/staged/types";
