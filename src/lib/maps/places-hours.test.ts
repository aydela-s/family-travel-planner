import { describe, expect, it } from "vitest";
import { hoursByWeekdayFromPlacesPeriods } from "@/lib/maps/places-hours";

describe("hoursByWeekdayFromPlacesPeriods", () => {
  it("marks missing weekdays closed and maps open windows", () => {
    const schedule = hoursByWeekdayFromPlacesPeriods([
      {
        open: { day: 3, hour: 10, minute: 0 },
        close: { day: 3, hour: 17, minute: 0 },
      },
      {
        open: { day: 6, hour: 9, minute: 30 },
        close: { day: 6, hour: 16, minute: 0 },
      },
    ]);

    expect(schedule?.[2]).toBeNull(); // Tuesday closed
    expect(schedule?.[3]).toEqual({ open: "10:00", close: "17:00" });
    expect(schedule?.[6]).toEqual({ open: "09:30", close: "16:00" });
  });

  it("returns undefined for empty periods", () => {
    expect(hoursByWeekdayFromPlacesPeriods([])).toBeUndefined();
    expect(hoursByWeekdayFromPlacesPeriods(undefined)).toBeUndefined();
  });
});
