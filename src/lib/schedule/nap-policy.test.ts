import { describe, expect, it } from "vitest";
import {
  isValidNapSelection,
  napEntry,
  shouldShowNapSection,
  validateNapsList,
} from "@/lib/planning-engine/nap-options";
import {
  applyNapTiming,
  getNapWindow,
  getRegularNapWindows,
  getStrollerNapWindows,
  hasStrollerNaps,
  napDurationMin,
  overlapsStrollerNap,
  shouldIncludeNaps,
} from "@/lib/schedule/nap-policy";
import { strollerQuietScore } from "@/lib/schedule/family-profile";
import { Landmark } from "@/config/city-pricing";
import { NapEntry, TripPlan } from "@/types/trip-plan";

function plan(naps: NapEntry[] | null, children: number[] = [2]): TripPlan {
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
    naps,
    budgetStyle: "balanced",
    interests: [],
  };
}

describe("structured naps — FAM-52", () => {
  it("hides nap section for adults-only and kids older than threshold", () => {
    expect(shouldShowNapSection({ children: [] })).toBe(false);
    expect(shouldShowNapSection({ children: [7] })).toBe(false);
    expect(shouldShowNapSection({ children: [8, 12] })).toBe(false);
    expect(shouldShowNapSection({ children: [6] })).toBe(true);
    expect(shouldShowNapSection({ children: [5] })).toBe(true);
    expect(shouldShowNapSection({ children: [3, 10] })).toBe(true);
  });

  it("requires an explicit nap answer when the section is shown", () => {
    expect(isValidNapSelection(null, { children: [2] })).toBe(false);
    expect(isValidNapSelection([], { children: [2] })).toBe(true);
    expect(
      isValidNapSelection([napEntry("12:00 PM", "2:00 PM")], { children: [2] }),
    ).toBe(true);
    expect(isValidNapSelection(null, { children: [8] })).toBe(true);
  });

  it("rejects overlapping or inverted nap windows", () => {
    expect(
      validateNapsList([
        napEntry("12:00 PM", "2:00 PM"),
        napEntry("1:00 PM", "3:00 PM"),
      ]),
    ).toMatch(/overlap/i);
    expect(validateNapsList([napEntry("2:00 PM", "12:00 PM")])).toMatch(/before/i);
  });

  it("skips stay-home naps when user chooses no naps", () => {
    expect(shouldIncludeNaps(plan([]))).toBe(false);
    expect(getNapWindow(plan([]))).toBeNull();
  });

  it("schedules regular naps inside the structured window", () => {
    const w = getNapWindow(plan([napEntry("12:00 PM", "2:00 PM")]));
    expect(w?.startMin).toBe(12 * 60);
    expect(w?.endMin).toBe(14 * 60);
  });

  it("honors a longer window end-to-end (12:30–2:30 → 2 hours)", () => {
    const p = plan([napEntry("12:30 PM", "2:30 PM")]);
    const w = getNapWindow(p);
    expect(w?.startMin).toBe(12 * 60 + 30);
    expect(w?.endMin).toBe(14 * 60 + 30);
    expect(napDurationMin(p)).toBe(120);
  });

  it("inserts a stay-home nap for regular, not for stroller-only", () => {
    const regular = applyNapTiming(
      [{ time: "10:00", title: "Museum", type: "activity" }],
      plan([napEntry("12:00 PM", "2:00 PM", "regular")]),
    );
    expect(regular.some((a) => a.type === "nap")).toBe(true);

    const strollerOnly = applyNapTiming(
      [{ time: "10:00", title: "Museum", type: "activity" }],
      plan([napEntry("12:00 PM", "2:00 PM", "stroller")]),
    );
    expect(strollerOnly.some((a) => a.type === "nap")).toBe(false);
    expect(hasStrollerNaps(plan([napEntry("12:00 PM", "2:00 PM", "stroller")]))).toBe(true);
  });

  it("supports multiple regular nap windows", () => {
    const windows = getRegularNapWindows(
      plan([
        napEntry("9:00 AM", "10:00 AM"),
        napEntry("1:00 PM", "2:30 PM"),
      ]),
    );
    expect(windows).toHaveLength(2);
    expect(windows[0]?.startMin).toBe(9 * 60);
    expect(windows[1]?.startMin).toBe(13 * 60);
  });

  it("detects visit overlap with stroller naps", () => {
    const p = plan([napEntry("3:00 PM", "5:00 PM", "stroller")]);
    expect(getStrollerNapWindows(p)).toHaveLength(1);
    expect(overlapsStrollerNap(p, 15 * 60 + 30, 16 * 60 + 30)).toBe(true);
    expect(overlapsStrollerNap(p, 10 * 60, 11 * 60)).toBe(false);
  });

  it("scores quiet landmarks higher for stroller naps", () => {
    const quiet: Landmark = {
      name: "Luxembourg Gardens",
      lat: 0,
      lng: 0,
      adultPrice: 0,
      openingHours: { open: "09:00", close: "18:00" },
      intensity: "low",
      indoor: false,
      ageTags: ["toddler", "child"],
      interestTags: ["parks", "nature"],
    };
    const loud: Landmark = {
      ...quiet,
      name: "Theme Park Thrills",
      intensity: "high",
      interestTags: ["theme-parks", "entertainment"],
    };
    expect(strollerQuietScore(quiet)).toBeGreaterThan(strollerQuietScore(loud));
  });
});
