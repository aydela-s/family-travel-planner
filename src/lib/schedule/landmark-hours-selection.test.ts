import { describe, expect, it } from "vitest";
import { CityConfig, Landmark } from "@/config/city-pricing";
import { buildLandmarkContext } from "@/lib/planning-engine/slot-filler";
import { pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import { isLandmarkOpenForVisit } from "@/lib/schedule/landmark-hours";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Test City",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

function landmark(
  partial: Partial<Landmark> & Pick<Landmark, "name" | "openingHours">,
): Landmark {
  return {
    lat: 32.72,
    lng: -117.16,
    adultPrice: 0,
    intensity: "medium",
    ageTags: ["child", "tween"],
    indoor: false,
    ...partial,
  };
}

const hoursCity: CityConfig = {
  id: "hours-test",
  name: "Hours Test",
  country: "US",
  currency: "USD",
  currencySymbol: "$",
  lat: 32.72,
  lng: -117.16,
  aliases: ["hours test"],
  taxiProviders: [{ name: "uber", label: "Uber", multiplier: 1 }],
  transport: {
    baseFare: 3,
    ratePerKm: 1,
    ratePerMin: 0.3,
    publicTransitDayPass: 6,
    publicTransitSingleRide: 2,
    fuelPricePerLiter: 1,
    avgFuelLitersPerDay: 8,
  },
  food: { breakfast: 20, lunch: 30, dinner: 40 },
  landmarks: [
    landmark({
      name: "Dawn Park",
      openingHours: { open: "06:00", close: "12:00" },
      lat: 32.72,
      lng: -117.16,
    }),
    landmark({
      name: "Evening Museum",
      openingHours: { open: "14:00", close: "22:00" },
      lat: 32.721,
      lng: -117.161,
      adultPrice: 15,
      indoor: true,
      ageTags: ["tween", "teen"],
    }),
    landmark({
      name: "All Day Plaza",
      openingHours: { open: "08:00", close: "20:00" },
      lat: 32.722,
      lng: -117.162,
    }),
  ],
};

describe("opening-hours preference at selection — P0", () => {
  it("prefers a landmark open for the morning visit window", () => {
    const plan = basePlan({ accommodationType: "hotel_breakfast_included" });
    const startMin = parseTimeToMinutes("08:30");
    const endMin = startMin + getIntensityConfig(plan).activityDurationMin;
    const window = { startMin, endMin };

    const pick = pickLandmarkForFamily(hoursCity, plan, 1, 0, [], window);

    expect(isLandmarkOpenForVisit(pick, window)).toBe(true);
    expect(pick.name).not.toBe("Evening Museum");
  });

  it("prefers a landmark open for the afternoon visit window", () => {
    const plan = basePlan();
    const startMin = parseTimeToMinutes("15:30");
    const endMin = startMin + getIntensityConfig(plan).activityDurationMin;
    const window = { startMin, endMin };
    const morning = hoursCity.landmarks.find((l) => l.name === "All Day Plaza")!;

    const pick = pickLandmarkForFamily(hoursCity, plan, 1, 1, [morning], window);

    expect(isLandmarkOpenForVisit(pick, window)).toBe(true);
    expect(pick.name).not.toBe("Dawn Park");
  });

  it("falls back to a closed landmark when nothing is open", () => {
    const plan = basePlan();
    const city: CityConfig = {
      ...hoursCity,
      landmarks: [
        landmark({
          name: "Late Opener",
          openingHours: { open: "11:00", close: "17:00" },
        }),
      ],
    };
    const window = { startMin: 8 * 60 + 30, endMin: 10 * 60 };

    const pick = pickLandmarkForFamily(city, plan, 1, 0, [], window);
    expect(pick.name).toBe("Late Opener");
  });

  it("buildLandmarkContext morning pick is open at the skeleton morning time", () => {
    const plan = basePlan({ accommodationType: "hotel_breakfast_included" });
    const ctx = buildLandmarkContext(hoursCity, plan, 1, 2);
    const startMin = parseTimeToMinutes("08:30");
    const endMin = startMin + getIntensityConfig(plan).activityDurationMin;

    expect(isLandmarkOpenForVisit(ctx.morning, { startMin, endMin })).toBe(true);
    expect(ctx.morning.name).not.toBe("Evening Museum");
  });
});
