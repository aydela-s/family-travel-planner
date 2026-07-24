import { describe, expect, it } from "vitest";
import {
  getDatesValidationError,
  MAX_TRIP_DAYS,
  maxEndDateForStart,
  todayIso,
  validateTripDates,
} from "@/lib/planning-engine/date-validation";
import { initialTripPlan, TripPlan } from "@/types/trip-plan";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function planWithDates(startDate: string, endDate: string): TripPlan {
  return { ...initialTripPlan, startDate, endDate };
}

describe("date validation — FAM-53 max trip length", () => {
  const start = todayIso();

  it(`allows trips up to ${MAX_TRIP_DAYS} inclusive days`, () => {
    const end = addDays(start, MAX_TRIP_DAYS - 1);
    expect(getDatesValidationError(planWithDates(start, end))).toBeNull();
    expect(validateTripDates(planWithDates(start, end))).toEqual([]);
  });

  it(`rejects trips longer than ${MAX_TRIP_DAYS} days`, () => {
    const end = addDays(start, MAX_TRIP_DAYS);
    const error = getDatesValidationError(planWithDates(start, end));
    expect(error).toMatch(/7 days/i);
    expect(validateTripDates(planWithDates(start, end))[0]?.code).toBe("trip_too_long");
  });

  it("computes the latest allowed return date from the start", () => {
    expect(maxEndDateForStart(start)).toBe(addDays(start, MAX_TRIP_DAYS - 1));
  });
});
