import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { activityLoadAgeBand, dailyLoadBudget } from "@/lib/schedule/activity-load";
import { TripPlan, TravelStyle } from "@/types/trip-plan";

/** When packed drops to fewer stops, stretch remaining activities to this length. */
export const PACKED_LONGER_ACTIVITY_MIN = 120;
/** Shortest packed extra stop we'll still schedule rather than dropping it. */
export const PACKED_EXTRA_MIN_DURATION_MIN = 45;

export type IntensityConfig = {
  style: TravelStyle | "";
  maxActivities: number;
  includeAfternoonActivity: boolean;
  includeExtraActivity: boolean;
  restBlocks: number;
  restDurationMin: number;
  activityDurationMin: number;
  longBreak: boolean;
  /** Soft load budget (FAM-77) — support selection respects this. */
  maxLoadUnits: number;
};

/**
 * @deprecated Prefer activityLoadAgeBand + dailyLoadBudget. Kept for call sites
 * that meant "this family wants a quiet paced day" — now only true for relaxed
 * with young kids (Dallas-style one outing / day).
 */
export function prefersSingleActivityDays(plan: TripPlan): boolean {
  if ((plan.travelStyle || "balanced") !== "relaxed") return false;
  const profile = getFamilyAgeProfile(plan);
  return profile.hasToddler || profile.hasYoungChild;
}

type AgeBand = ReturnType<typeof activityLoadAgeBand>;

/** Slot caps by style × youngest-child band (FAM-76).
 * Style still strictly orders slot counts (packed > balanced > relaxed).
 * Age mainly scales load budget + durations so the same style feels different.
 */
function maxActivitiesFor(style: TravelStyle, band: AgeBand): number {
  const table: Record<TravelStyle, Record<AgeBand, number>> = {
    relaxed: { young: 1, school: 1, adult: 1 },
    balanced: { young: 2, school: 2, adult: 2 },
    packed: { young: 3, school: 3, adult: 3 },
  };
  return table[style][band];
}

function activityDurationFor(style: TravelStyle, band: AgeBand): number {
  if (style === "relaxed") return band === "young" ? 120 : 105;
  if (style === "packed") return band === "young" ? 75 : 70;
  // balanced — young kids get slightly longer hero stops
  return band === "young" ? 95 : band === "school" ? 90 : 85;
}

export function getIntensityConfig(plan: TripPlan): IntensityConfig {
  const style: TravelStyle = plan.travelStyle || "balanced";
  const band = activityLoadAgeBand(plan);
  const maxActivities = maxActivitiesFor(style, band);
  const maxLoadUnits = dailyLoadBudget(plan);

  if (style === "relaxed") {
    return {
      style,
      maxActivities,
      includeAfternoonActivity: false,
      includeExtraActivity: false,
      restBlocks: 2,
      restDurationMin: 50,
      activityDurationMin: activityDurationFor(style, band),
      longBreak: true,
      maxLoadUnits,
    };
  }

  if (style === "packed") {
    // Packed must schedule more slots than balanced for every family.
    return {
      style,
      maxActivities,
      includeAfternoonActivity: true,
      includeExtraActivity: true,
      restBlocks: 1,
      restDurationMin: band === "young" ? 30 : 25,
      activityDurationMin: activityDurationFor(style, band),
      longBreak: false,
      maxLoadUnits,
    };
  }

  // balanced — two meaningful stops; age/nap soften load budget (FAM-76/77).
  return {
    style: "balanced",
    maxActivities,
    includeAfternoonActivity: true,
    includeExtraActivity: false,
    restBlocks: 1,
    restDurationMin: 35,
    activityDurationMin: activityDurationFor(style, band),
    longBreak: false,
    maxLoadUnits,
  };
}

export function isRelaxedDay(plan: TripPlan): boolean {
  return plan.travelStyle === "relaxed";
}
