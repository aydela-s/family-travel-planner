import { describe, expect, it } from "vitest";
import {
  getTripDateContext,
  isWeekendDate,
  tripLengthHint,
} from "@/lib/planning-engine/trip-date-context";

describe("trip date context", () => {
  it("detects weekend days inside a date range", () => {
    // Mon 2026-07-13 through Wed 2026-07-15 — no weekend
    const weekdays = getTripDateContext("2026-07-13", "2026-07-15");
    expect(weekdays).toMatchObject({
      dayCount: 3,
      weekendDays: 0,
      includesWeekend: false,
      weekdayOnly: true,
    });

    // Fri 2026-07-17 through Sun 2026-07-19 — full weekend
    const weekend = getTripDateContext("2026-07-17", "2026-07-19");
    expect(weekend).toMatchObject({
      dayCount: 3,
      weekendDays: 2,
      includesWeekend: true,
      weekdayOnly: false,
    });
  });

  it("does not call a weekday trip a long weekend", () => {
    const context = getTripDateContext("2026-07-13", "2026-07-15")!;
    expect(tripLengthHint(context)).toContain("midweek");
    expect(tripLengthHint(context)).not.toContain("long weekend");
  });

  it("calls a Fri–Sun trip a long weekend", () => {
    const context = getTripDateContext("2026-07-17", "2026-07-19")!;
    expect(tripLengthHint(context)).toContain("long weekend");
  });

  it("mentions two weeks for trips of 14+ days", () => {
    const context = getTripDateContext("2026-08-01", "2026-08-14")!;
    expect(context.dayCount).toBe(14);
    expect(tripLengthHint(context)).toContain("two weeks");
  });

  it("classifies Saturday and Sunday as weekend dates", () => {
    expect(isWeekendDate("2026-07-18")).toBe(true); // Saturday
    expect(isWeekendDate("2026-07-19")).toBe(true); // Sunday
    expect(isWeekendDate("2026-07-20")).toBe(false); // Monday
  });
});
