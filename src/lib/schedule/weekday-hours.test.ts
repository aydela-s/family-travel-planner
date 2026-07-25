import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, Landmark } from "@/config/city-pricing";
import {
  hoursForDate,
  isLandmarkOpenForVisit,
  weekdayIndexFromIso,
} from "@/lib/schedule/landmark-hours";
import { pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego, CA",
    startDate: "2026-08-11", // Tuesday
    endDate: "2026-08-13",
    adults: 2,
    children: [5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Interactive Museums", "Museums & Art"],
    ...overrides,
  };
}

describe("weekday opening hours", () => {
  const fleet = CITY_CONFIGS.find((c) => c.id === "san-diego")!.landmarks.find(
    (l) => l.name === "Fleet Science Center",
  )!;

  it("treats Tuesday as closed for Fleet Science Center", () => {
    expect(weekdayIndexFromIso("2026-08-11")).toBe(2);
    expect(hoursForDate(fleet, "2026-08-11")).toBeNull();
    expect(
      isLandmarkOpenForVisit(fleet, {
        startMin: 10 * 60,
        endMin: 12 * 60,
        visitDate: "2026-08-11",
      }),
    ).toBe(false);
  });

  it("keeps Fleet open on a Wednesday with typical hours", () => {
    expect(hoursForDate(fleet, "2026-08-12")).toEqual(fleet.openingHours);
    expect(
      isLandmarkOpenForVisit(fleet, {
        startMin: 10 * 60,
        endMin: 12 * 60,
        visitDate: "2026-08-12",
      }),
    ).toBe(true);
  });

  it("does not pick a Tuesday-closed museum on Tuesday when alternatives exist", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const plan = basePlan({ startDate: "2026-08-11", endDate: "2026-08-11" });
    const pick = pickLandmarkForFamily(city, plan, 1, 0, [], {
      visitWindow: { startMin: 10 * 60, endMin: 12 * 60, visitDate: "2026-08-11" },
    });
    expect(pick.name).not.toBe("Fleet Science Center");
    expect(pick.name).not.toBe("The New Children's Museum");
  });

  it("falls back to openingHours when hoursByWeekday is absent", () => {
    const park: Landmark = {
      name: "Open Park",
      lat: 0,
      lng: 0,
      adultPrice: 0,
      openingHours: { open: "08:00", close: "18:00" },
      intensity: "low",
      ageTags: ["child"],
      interestTags: ["parks"],
      indoor: false,
    };
    expect(hoursForDate(park, "2026-08-11")).toEqual(park.openingHours);
  });
});
