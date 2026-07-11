import { validateRawDay } from "@/lib/schedule/fix-itinerary";
import { validateTripDates } from "@/lib/planning-engine/date-validation";
import { ValidationIssue } from "@/lib/planning-engine/types";
import { RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type { ValidationIssue };

export function validatePlannedItinerary(
  raw: RawItinerary,
  plan: TripPlan,
  options?: { adjustDay?: number; adjustNote?: string },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateTripDates(plan)];

  for (const day of raw.days) {
    issues.push(
      ...validateRawDay(
        day.activities,
        plan,
        day.day === options?.adjustDay ? options.adjustNote : undefined,
      ),
    );
  }

  return issues;
}
