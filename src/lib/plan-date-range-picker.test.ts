import { describe, expect, it } from "vitest";
import { getTripDayCount } from "@/lib/itinerary";
import { MAX_TRIP_DAYS } from "@/lib/planning-engine/date-validation";
import {
  applyRangeDayClick,
  eachIsoDayInclusive,
  formatTripDateRangeField,
  isTripDateDisabled,
  isValidTripEndDate,
  toIsoDate,
} from "@/lib/plan-date-range-picker";

const TODAY = "2026-08-18";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

describe("formatTripDateRangeField", () => {
  it("formats a short month-day range", () => {
    expect(formatTripDateRangeField("2026-08-18", "2026-08-22")).toBe("Aug 18 – Aug 22");
  });

  it("formats a single day without a dash", () => {
    expect(formatTripDateRangeField("2026-08-18", "2026-08-18")).toBe("Aug 18");
  });
});

describe("applyRangeDayClick", () => {
  it("allows a 1-day trip", () => {
    const first = applyRangeDayClick(TODAY, "", "", false, TODAY);
    expect(first).toEqual({
      startDate: TODAY,
      endDate: TODAY,
      pickingEnd: true,
      complete: false,
    });
    const second = applyRangeDayClick(TODAY, TODAY, TODAY, true, TODAY);
    expect(second).toEqual({
      startDate: TODAY,
      endDate: TODAY,
      pickingEnd: false,
      complete: true,
    });
    expect(getTripDayCount(TODAY, TODAY)).toBe(1);
  });

  it("allows a 2-day trip", () => {
    const end = addDays(TODAY, 1);
    const first = applyRangeDayClick(TODAY, "", "", false, TODAY)!;
    const second = applyRangeDayClick(end, first.startDate, first.endDate, true, TODAY)!;
    expect(second.complete).toBe(true);
    expect(getTripDayCount(second.startDate, second.endDate)).toBe(2);
    expect(second.startDate).toBe(TODAY);
    expect(second.endDate).toBe(end);
  });

  it("allows a 7-day inclusive trip", () => {
    const end = addDays(TODAY, MAX_TRIP_DAYS - 1);
    const first = applyRangeDayClick(TODAY, "", "", false, TODAY)!;
    const second = applyRangeDayClick(end, first.startDate, first.endDate, true, TODAY)!;
    expect(second.complete).toBe(true);
    expect(getTripDayCount(second.startDate, second.endDate)).toBe(7);
  });

  it("blocks selecting an 8-day trip", () => {
    const end = addDays(TODAY, MAX_TRIP_DAYS);
    const first = applyRangeDayClick(TODAY, "", "", false, TODAY)!;
    const blocked = applyRangeDayClick(end, first.startDate, first.endDate, true, TODAY);
    expect(blocked).toBeNull();
    expect(isValidTripEndDate(TODAY, end, TODAY)).toBe(false);
  });

  it("blocks dates before the start while picking an end date", () => {
    const start = addDays(TODAY, 3);
    const earlier = addDays(TODAY, 1);
    expect(isValidTripEndDate(start, earlier, TODAY)).toBe(false);
    expect(isTripDateDisabled(earlier, TODAY, start, true)).toBe(true);
    const first = applyRangeDayClick(start, "", "", false, TODAY)!;
    const blocked = applyRangeDayClick(earlier, first.startDate, first.endDate, true, TODAY);
    expect(blocked).toBeNull();
  });

  it("keeps pickingEnd through the first click so a second click can complete the range", () => {
    const first = applyRangeDayClick(TODAY, "", "", false, TODAY)!;
    expect(first.pickingEnd).toBe(true);
    const end = addDays(TODAY, 3);
    const second = applyRangeDayClick(end, first.startDate, first.endDate, first.pickingEnd, TODAY)!;
    expect(second.complete).toBe(true);
    expect(second.startDate).toBe(TODAY);
    expect(second.endDate).toBe(end);
  });

  it("supports a range crossing a month boundary", () => {
    const start = "2026-08-28";
    const end = "2026-09-02";
    const first = applyRangeDayClick(start, "", "", false, TODAY)!;
    const second = applyRangeDayClick(end, first.startDate, first.endDate, true, TODAY)!;
    expect(second.complete).toBe(true);
    expect(eachIsoDayInclusive(second.startDate, second.endDate)).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("lets the user change an already-selected range", () => {
    const oldStart = TODAY;
    const oldEnd = addDays(TODAY, 2);
    const newStart = addDays(TODAY, 5);
    const newEnd = addDays(TODAY, 6);

    const restart = applyRangeDayClick(newStart, oldStart, oldEnd, false, TODAY)!;
    expect(restart).toEqual({
      startDate: newStart,
      endDate: newStart,
      pickingEnd: true,
      complete: false,
    });

    const finished = applyRangeDayClick(
      newEnd,
      restart.startDate,
      restart.endDate,
      true,
      TODAY,
    )!;
    expect(finished.startDate).toBe(newStart);
    expect(finished.endDate).toBe(newEnd);
    expect(finished.complete).toBe(true);
  });

  it("preserves ISO date values in form state", () => {
    const start = "2026-12-01";
    const end = "2026-12-04";
    const first = applyRangeDayClick(start, "", "", false, TODAY)!;
    const second = applyRangeDayClick(end, first.startDate, first.endDate, true, TODAY)!;
    expect(second.startDate).toBe("2026-12-01");
    expect(second.endDate).toBe("2026-12-04");
  });
});

describe("isTripDateDisabled", () => {
  it("disables dates beyond the 7-day window while picking an end date", () => {
    const start = TODAY;
    const tooFar = addDays(start, MAX_TRIP_DAYS);
    expect(isTripDateDisabled(tooFar, TODAY, start, true)).toBe(true);
    expect(isTripDateDisabled(addDays(start, MAX_TRIP_DAYS - 1), TODAY, start, true)).toBe(false);
  });

  it("does not allow dates before the anchor while picking an end date", () => {
    const start = addDays(TODAY, 3);
    expect(isTripDateDisabled(TODAY, TODAY, start, true)).toBe(true);
  });
});
