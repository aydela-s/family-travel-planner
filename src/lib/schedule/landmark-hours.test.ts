import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, Landmark } from "@/config/city-pricing";
import {
  findLandmarkByName,
  hoursAreReliable,
  isKnownClosedForVisit,
  isWithinOpeningHours,
  validateActivityOpeningHours,
} from "@/lib/schedule/landmark-hours";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";

const louvre: Landmark = {
  name: "Louvre Museum",
  lat: 48.86,
  lng: 2.34,
  adultPrice: 22,
  openingHours: { open: "09:00", close: "18:00" },
  intensity: "high",
  ageTags: ["tween", "teen"],
  interestTags: ["museums"],
  indoor: true,
};

describe("landmark opening hours", () => {
  it("treats curated typical hours as reliable and category guesses as not", () => {
    expect(hoursAreReliable(louvre)).toBe(true);
    expect(hoursAreReliable({ ...louvre, hoursConfidence: "assumed" })).toBe(false);
    expect(hoursAreReliable({ hoursConfidence: "assumed" })).toBe(false);
    expect(
      isKnownClosedForVisit(
        { ...louvre, hoursByWeekday: { 2: null } },
        { startMin: 10 * 60, endMin: 12 * 60, visitDate: "2026-08-11" },
      ),
    ).toBe(true);
    expect(
      isKnownClosedForVisit(
        { ...louvre, hoursConfidence: "assumed", openingHours: { open: "18:00", close: "19:00" } },
        { startMin: 10 * 60, endMin: 12 * 60, visitDate: "2026-08-11" },
      ),
    ).toBe(false);
  });

  it("accepts a visit fully inside opening hours", () => {
    expect(isWithinOpeningHours(10 * 60, 12 * 60, louvre.openingHours)).toBe(true);
  });

  it("rejects a visit that starts before open", () => {
    expect(isWithinOpeningHours(8 * 60, 10 * 60, louvre.openingHours)).toBe(false);
  });

  it("rejects a visit that ends after close", () => {
    expect(isWithinOpeningHours(17 * 60, 19 * 60, louvre.openingHours)).toBe(false);
  });

  it("flags soft violations for activities outside hours", () => {
    const issues = validateActivityOpeningHours(
      [
        {
          time: "08:00",
          endTime: "09:30",
          title: "Explore Louvre Museum",
          type: "activity",
          location: { name: "Louvre Museum" },
        },
      ],
      [louvre],
      () => 90,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("outside_opening_hours");
    expect(issues[0].landmarkName).toBe("Louvre Museum");
  });

  it("treats a known-closed weekday as a reliable enrichment failure when visitDate is passed", () => {
    const museum: Landmark = {
      ...louvre,
      hoursByWeekday: { 2: null },
    };
    const activity = {
      time: "10:00",
      endTime: "12:00",
      title: "Explore Louvre Museum",
      type: "activity" as const,
      location: { name: "Louvre Museum" },
    };
    const withoutDate = validateActivityOpeningHours([activity], [museum], () => 120);
    expect(withoutDate).toEqual([]);

    const withDate = validateActivityOpeningHours(
      [activity],
      [museum],
      () => 120,
      "2026-08-11",
    );
    expect(withDate).toHaveLength(1);
    expect(withDate[0]!.code).toBe("closed_that_day");
    expect(withDate[0]!.hoursReliable).toBe(true);
  });

  it("does not treat assumed category hours as a reliable closed-day failure", () => {
    const guessed: Landmark = {
      ...louvre,
      hoursConfidence: "assumed",
      openingHours: { open: "09:00", close: "10:00" },
    };
    const issues = validateActivityOpeningHours(
      [
        {
          time: "14:00",
          endTime: "16:00",
          title: "Explore Louvre Museum",
          type: "activity",
          location: { name: "Louvre Museum" },
        },
      ],
      [guessed],
      () => 120,
      "2026-08-11",
    );
    expect(issues[0]!.hoursReliable).toBe(false);
  });

  it("does not flag meals or rest blocks", () => {
    const issues = validateActivityOpeningHours(
      [
        {
          time: "07:00",
          endTime: "08:00",
          title: "Breakfast",
          type: "meal",
          location: { name: "Louvre Museum" },
        },
      ],
      [louvre],
      () => 60,
    );
    expect(issues).toEqual([]);
  });

  it("finds landmarks by partial title match", () => {
    expect(findLandmarkByName([louvre], "Near Louvre Museum cafe")?.name).toBe("Louvre Museum");
  });
});

describe("city catalog — Phase 2 fields", () => {
  it("every landmark has opening hours, intensity, age tags, interest tags, and indoor flag", () => {
    for (const city of CITY_CONFIGS) {
      expect(city.landmarks.length).toBeGreaterThan(0);
      for (const landmark of city.landmarks) {
        expect(parseTimeToMinutes(landmark.openingHours.open)).toBeLessThan(
          parseTimeToMinutes(landmark.openingHours.close),
        );
        expect(["low", "medium", "high"]).toContain(landmark.intensity);
        expect(landmark.ageTags.length).toBeGreaterThan(0);
        expect(landmark.interestTags.length).toBeGreaterThan(0);
        expect(typeof landmark.indoor).toBe("boolean");
      }
    }
  });
});
