import { Landmark } from "@/config/city-pricing";
import { DayLandmarkContext, SlotKind } from "@/lib/planning-engine/types";
import { haversineKm } from "@/lib/maps/directions";
import { defaultTravelMin } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

type Located = { lat: number; lng: number };

type ActivityRef = {
  title: string;
  type: string;
  slotKind?: SlotKind;
};

/** Map/enrich travel must exceed expected by this ratio to trigger a traffic pad. */
export const TRAVEL_THRESHOLD_RATIO = 1.5;

/** Extra pad applied when the threshold fires (stand-in for traffic delay). */
export const TRAVEL_TRAFFIC_BUFFER = 1.15;

export const MIN_SEGMENT_TRAVEL_MIN = 10;

/** Estimate travel minutes from straight-line distance (same formula as maps/directions fallback). */
export function estimateTravelMinBetween(
  from: Located,
  to: Located,
  plan: TripPlan,
): number {
  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const walking = plan.transportationType === "walking";
  const roadFactor = walking ? 1.3 : 1.45;
  const distanceKm = Math.max(0.5, Math.round(straight * roadFactor * 10) / 10);
  const fromDistance = walking
    ? Math.round(distanceKm * 12)
    : Math.round(distanceKm * 3.2 + 5);

  // Never schedule less travel than the age/transport base gap.
  return Math.max(defaultTravelMin(plan), fromDistance);
}

/**
 * When enrich/map travel ≫ the haversine estimate, pad the gap as a traffic buffer.
 * Otherwise keep the measured segment (floored).
 */
export function applyTravelThreshold(expectedMin: number, actualMin: number): number {
  const actual = Math.max(actualMin, MIN_SEGMENT_TRAVEL_MIN);
  if (actual > expectedMin * TRAVEL_THRESHOLD_RATIO) {
    return Math.ceil(actual * TRAVEL_TRAFFIC_BUFFER);
  }
  return actual;
}

function landmarkForSlot(kind: SlotKind | undefined, ctx: DayLandmarkContext): Landmark | null {
  switch (kind) {
    case "breakfast":
    case "morning_activity":
      return ctx.morning;
    case "lunch":
      return ctx.lunch;
    case "midday_rest":
    case "afternoon_rest":
    case "afternoon_activity":
    case "calm_activity":
      return ctx.afternoon;
    case "extra_activity":
      return ctx.extra ?? ctx.afternoon;
    case "grocery":
      return ctx.afternoon;
    case "evening_rest":
    case "dinner":
      return ctx.dinner;
    default:
      return null;
  }
}

/**
 * One travel gap per consecutive activity pair, from day landmark context.
 * Used on the raw schedule pass before map directions exist.
 */
export function estimateTravelGapsForDay(
  activities: ActivityRef[],
  ctx: DayLandmarkContext,
  plan: TripPlan,
): number[] {
  if (activities.length < 2) return [];

  const gaps: number[] = [];
  for (let i = 0; i < activities.length - 1; i++) {
    const from = landmarkForSlot(activities[i].slotKind, ctx);
    const to = landmarkForSlot(activities[i + 1].slotKind, ctx);
    if (from && to) {
      gaps.push(estimateTravelMinBetween(from, to, plan));
    } else {
      gaps.push(defaultTravelMin(plan));
    }
  }
  return gaps;
}
