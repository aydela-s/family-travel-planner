import { describe, expect, it } from "vitest";
import {
  dinnerDefaultTime,
  dinnerTimeWindow,
  groceryLocationNearRoute,
  lunchDefaultTime,
  lunchTimeWindow,
} from "@/lib/planning-engine/meal-timing";
import { TripPlan } from "@/types/trip-plan";

function plan(children: number[]): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    adults: 2,
    children,
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "",
    budgetStyle: "balanced",
    interests: [],
  };
}

describe("meal timing business rules", () => {
  describe("lunch — age-conditional windows", () => {
    it("uses 11:30–12:00 when oldest child is 7 or younger", () => {
      const window = lunchTimeWindow(plan([2, 5]));
      expect(window.minMin).toBe(11 * 60 + 30);
      expect(window.maxMin).toBe(12 * 60);
      expect(lunchDefaultTime(plan([2, 5]))).toBe("11:45");
    });

    it("uses 12:00–13:30 when oldest child is over 7", () => {
      const window = lunchTimeWindow(plan([9, 12]));
      expect(window.minMin).toBe(12 * 60);
      expect(window.maxMin).toBe(13 * 60 + 30);
      expect(lunchDefaultTime(plan([9, 12]))).toBe("12:30");
    });

    it("uses the older-kid lunch window for adults only", () => {
      expect(lunchDefaultTime(plan([]))).toBe("12:30");
    });
  });

  describe("dinner — age-conditional windows", () => {
    it("uses 17:00–19:00 when all kids are 7 or younger", () => {
      const window = dinnerTimeWindow(plan([2, 5]));
      expect(window.minMin).toBe(17 * 60);
      expect(window.maxMin).toBe(19 * 60);
    });

    it("uses 18:00–20:00 when all kids are 7 or older", () => {
      const window = dinnerTimeWindow(plan([10, 16]));
      expect(window.minMin).toBe(18 * 60);
      expect(window.maxMin).toBe(20 * 60);
      expect(dinnerDefaultTime(plan([10, 16]))).toBe("18:30");
    });

    it("uses the intersection for mixed ages (young + teen)", () => {
      const window = dinnerTimeWindow(plan([5, 10]));
      expect(window.minMin).toBe(18 * 60);
      expect(window.maxMin).toBe(19 * 60);
    });
  });

  describe("grocery — route-relative placement", () => {
    it("anchors the supermarket near the last stop before dinner", () => {
      const activities = [
        { location: { name: "Louvre", lat: 48.86, lng: 2.34 } },
        { location: undefined },
        { location: { name: "Park", lat: 48.87, lng: 2.35 } },
      ];
      const loc = groceryLocationNearRoute(activities, 2, {
        lat: 48.85,
        lng: 2.33,
        landmarks: [],
      } as never);
      expect(loc.name).toContain("Louvre");
      expect(loc.lat).toBeCloseTo(48.863);
    });
  });
});
