import { describe, expect, it } from "vitest";
import {
  minutesToTime,
  scheduleSpan,
  snapMinutes,
  snapMinutesUp,
  TIME_SNAP_MINUTES,
  travelSpan,
} from "@/lib/schedule/timeline";

describe("time snapping — FAM-12", () => {
  it("snaps to 15-minute increments", () => {
    expect(TIME_SNAP_MINUTES).toBe(15);
    expect(snapMinutes(14 * 60 + 14)).toBe(14 * 60 + 15); // 14:14 → 14:15
    expect(snapMinutes(15 * 60 + 29)).toBe(15 * 60 + 30); // 15:29 → 15:30
    expect(snapMinutes(11 * 60 + 7)).toBe(11 * 60); // 11:07 → 11:00
  });

  it("formats snapped clock times without odd minutes", () => {
    expect(minutesToTime(14 * 60 + 14)).toBe("14:15");
    expect(minutesToTime(15 * 60 + 29)).toBe("15:30");
    expect(minutesToTime(12 * 60 + 45)).toBe("12:45");
  });

  it("snaps both ends of a span so displays never show :32", () => {
    const span = scheduleSpan(8 * 60 + 30, 62);
    expect(span.time).toBe("08:30");
    expect(span.endTime).toBe("09:30");
  });

  it("rounds travel ends up so a 6-minute taxi is 12:00–12:15, never 12:00–12:00", () => {
    expect(snapMinutesUp(12 * 60 + 6)).toBe(12 * 60 + 15);
    const span = travelSpan(12 * 60, 6);
    expect(span.time).toBe("12:00");
    expect(span.endTime).toBe("12:15");
    expect(span.endTime).not.toBe(span.time);
  });
});
