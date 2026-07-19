import { describe, expect, it } from "vitest";
import { tripLengthHint } from "@/lib/planning-engine/trip-date-context";

describe("tripLengthHint — FAM-9", () => {
  it("does not say long weekend for a weekday-only short trip", () => {
    // Mon Jul 13 – Wed Jul 15, 2026
    const hint = tripLengthHint("2026-07-13", "2026-07-15");
    expect(hint).toMatch(/midweek/i);
    expect(hint?.toLowerCase()).not.toContain("weekend");
  });

  it("says long weekend when the short trip includes Sat/Sun", () => {
    // Fri Jul 17 – Sun Jul 19, 2026
    const hint = tripLengthHint("2026-07-17", "2026-07-19");
    expect(hint?.toLowerCase()).toContain("long weekend");
  });

  it("handles a single weekday day without weekend language", () => {
    const hint = tripLengthHint("2026-07-14", "2026-07-14");
    expect(hint?.toLowerCase()).toContain("midweek");
    expect(hint?.toLowerCase()).not.toContain("weekend");
  });
});
