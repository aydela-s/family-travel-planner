import { getTripDayCount } from "@/lib/itinerary";
import { TripPlan } from "@/types/trip-plan";
import { ValidationIssue } from "@/lib/planning-engine/types";

/** Inclusive trip length cap (departure through return). */
export const MAX_TRIP_DAYS = 7;

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Latest return date allowed for a given departure (inclusive day count). */
export function maxEndDateForStart(startIso: string): string {
  const start = new Date(`${startIso}T12:00:00`);
  start.setDate(start.getDate() + (MAX_TRIP_DAYS - 1));
  return start.toISOString().slice(0, 10);
}

/** User-facing message for the wizard dates step */
export function getDatesValidationError(plan: TripPlan): string | null {
  if (!plan.startDate || !plan.endDate) {
    return "Please enter both your departure and return dates.";
  }
  if (plan.startDate < todayIso()) {
    return "Your trip can't start in the past — pick today or a future date.";
  }
  if (plan.endDate < plan.startDate) {
    return "Your return date must be on or after your departure date.";
  }
  const dayCount = getTripDayCount(plan.startDate, plan.endDate);
  if (dayCount > MAX_TRIP_DAYS) {
    return `Trips are limited to ${MAX_TRIP_DAYS} days — shorten your dates to continue.`;
  }
  return null;
}

export function validateTripDates(plan: TripPlan): ValidationIssue[] {
  const message = getDatesValidationError(plan);
  if (!message) return [];

  const code =
    !plan.startDate || !plan.endDate
      ? "dates_missing"
      : plan.startDate < todayIso()
        ? "start_in_past"
        : plan.endDate < plan.startDate
          ? "dates_inverted"
          : getTripDayCount(plan.startDate, plan.endDate) > MAX_TRIP_DAYS
            ? "trip_too_long"
            : "dates_invalid";

  return [{ code, message }];
}

export function isValidTripDates(plan: TripPlan): boolean {
  return getDatesValidationError(plan) === null;
}

export function getTripDayCountValidated(plan: TripPlan): number {
  return getTripDayCount(plan.startDate, plan.endDate);
}
