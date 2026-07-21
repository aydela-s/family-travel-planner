import { describe, expect, it } from "vitest";
import { isValidNapSelection } from "@/lib/planning-engine/nap-options";
import {
  getNapWindow,
  napDurationMin,
  parseNapWindow,
  shouldIncludeNaps,
} from "@/lib/schedule/nap-policy";
import { TripPlan } from "@/types/trip-plan";

function plan(napSchedule: string, children: number[] = [2]): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-07-14",
    endDate: "2026-07-16",
    adults: 2,
    children,
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule,
    budgetStyle: "balanced",
    interests: [],
  };
}

describe("parseNapWindow — FAM-40", () => {
  it("parses 12-2 PM as noon to 2 PM", () => {
    const w = parseNapWindow("12-2 PM");
    expect(w).toEqual({
      startMin: 12 * 60,
      endMin: 14 * 60,
      label: "afternoon nap window",
    });
  });

  it("parses 9-11 AM as a morning window", () => {
    const w = parseNapWindow("9-11 AM");
    expect(w?.startMin).toBe(9 * 60);
    expect(w?.endMin).toBe(11 * 60);
    expect(w?.label).toContain("morning");
  });

  it("parses 24h 13:00-15:00", () => {
    expect(parseNapWindow("13:00-15:00")?.startMin).toBe(13 * 60);
    expect(parseNapWindow("13:00-15:00")?.endMin).toBe(15 * 60);
  });

  it("parses 11:30-1:30 as late morning through early afternoon", () => {
    const w = parseNapWindow("11:30-1:30");
    expect(w?.startMin).toBe(11 * 60 + 30);
    expect(w?.endMin).toBe(13 * 60 + 30);
    expect(w?.label).toContain("morning");
  });

  it("parses 11:30-1:30 PM the same way", () => {
    const w = parseNapWindow("11:30-1:30 PM");
    expect(w?.startMin).toBe(11 * 60 + 30);
    expect(w?.endMin).toBe(13 * 60 + 30);
  });

  it("keeps legacy afternoon chip working", () => {
    const w = parseNapWindow("Afternoon nap (1–3 PM)");
    expect(w?.startMin).toBe(13 * 60);
    expect(w?.endMin).toBe(15 * 60);
  });
});

describe("nap selection — FAM-40", () => {
  it("accepts free-text windows and no-nap", () => {
    expect(isValidNapSelection("12-2 PM", true)).toBe(true);
    expect(isValidNapSelection("No naps needed", true)).toBe(true);
    expect(isValidNapSelection("", true)).toBe(false);
  });

  it("skips naps when user chooses no naps", () => {
    expect(shouldIncludeNaps(plan("No naps needed"))).toBe(false);
    expect(getNapWindow(plan("No naps needed"))).toBeNull();
  });

  it("schedules naps inside the typed window", () => {
    const w = getNapWindow(plan("12-2 PM"));
    expect(w?.startMin).toBe(12 * 60);
    expect(w?.endMin).toBe(14 * 60);
  });

  it("honors a longer typed window end time (12:30-2:30 → 2 hours, not capped at 90)", () => {
    const p = plan("12:30-2:30");
    const w = getNapWindow(p);
    expect(w?.startMin).toBe(12 * 60 + 30);
    expect(w?.endMin).toBe(14 * 60 + 30);
    expect(napDurationMin(p)).toBe(120);
  });
});
