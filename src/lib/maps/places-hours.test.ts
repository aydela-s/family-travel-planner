import { describe, expect, it } from "vitest";
import type { Landmark } from "@/config/city-pricing";
import {
  applyPlacesHoursToLandmark,
  hoursByWeekdayFromPlacesPeriods,
  hoursByWeekdayFromRegularOpeningHours,
  isGooglePlaceId,
  mergeHoursByWeekdayPreferExisting,
  typicalOpeningHoursFromWeekday,
} from "@/lib/maps/places-hours";
import { hoursForDate, isLandmarkOpenForVisit } from "@/lib/schedule/landmark-hours";
import { pickLandmarkForFamily } from "@/lib/schedule/family-profile";
import type { CityConfig } from "@/config/city-pricing";
import type { TripPlan } from "@/types/trip-plan";
import { landmarkFromTopActivity, landmarksFromPlacesResults } from "@/lib/maps/places-city-config";
import { rankTopActivitiesFromPlaces, type PlacesSearchTextPlace } from "@/lib/maps/get-top-activities";

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

describe("hoursByWeekdayFromRegularOpeningHours", () => {
  it("maps Text Search regularOpeningHours into weekday table", () => {
    const schedule = hoursByWeekdayFromRegularOpeningHours({
      periods: [
        {
          open: { day: 3, hour: 10, minute: 0 },
          close: { day: 3, hour: 17, minute: 0 },
        },
      ],
    });
    expect(schedule?.[3]).toEqual({ open: "10:00", close: "17:00" });
    expect(schedule?.[2]).toBeNull();
  });
});

describe("mergeHoursByWeekdayPreferExisting (FAM-66)", () => {
  it("prefers curated weekday entries and fills Places gaps only", () => {
    const curated = {
      2: null,
      3: { open: "10:00", close: "16:00" },
    };
    const fromPlaces = hoursByWeekdayFromPlacesPeriods([
      { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 17, minute: 0 } },
      { open: { day: 3, hour: 11, minute: 0 }, close: { day: 3, hour: 18, minute: 0 } },
      { open: { day: 4, hour: 9, minute: 0 }, close: { day: 4, hour: 17, minute: 0 } },
    ])!;

    const merged = mergeHoursByWeekdayPreferExisting(curated, fromPlaces)!;
    expect(merged[2]).toBeNull(); // curated closed Tuesday wins
    expect(merged[3]).toEqual({ open: "10:00", close: "16:00" }); // curated hours win
    expect(merged[4]).toEqual({ open: "09:00", close: "17:00" }); // Places fills Thursday gap
  });

  it("adopts Places schedule when landmark has no weekday table", () => {
    const fromPlaces = hoursByWeekdayFromPlacesPeriods([
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 0 } },
    ])!;
    const landmark: Landmark = {
      name: "Science Spot",
      lat: 1,
      lng: 2,
      adultPrice: 20,
      openingHours: { open: "09:00", close: "18:00" },
      intensity: "low",
      ageTags: ["child"],
      interestTags: ["interactive"],
      indoor: true,
      placeId: "ChIJScienceSpotTest123456",
    };
    const next = applyPlacesHoursToLandmark(landmark, fromPlaces);
    expect(next.hoursByWeekday?.[1]).toEqual({ open: "09:00", close: "17:00" });
    expect(next.hoursByWeekday?.[2]).toBeNull();
    expect(typicalOpeningHoursFromWeekday(next.hoursByWeekday)).toEqual({
      open: "09:00",
      close: "17:00",
    });
  });

  it("detects Google place ids vs local catalog ids", () => {
    expect(isGooglePlaceId("dallas")).toBe(false);
    expect(isGooglePlaceId("ChIJabc")).toBe(true);
    expect(isGooglePlaceId("places/ChIJabc")).toBe(true);
  });
});

describe("Text Search hours → closed-day skip (FAM-66)", () => {
  /** Wed–Sun open; Mon+Tue closed — as returned on Places Text Search. */
  const closedTuePeriods = {
    periods: [
      { open: { day: 3, hour: 10, minute: 0 }, close: { day: 3, hour: 17, minute: 0 } },
      { open: { day: 4, hour: 10, minute: 0 }, close: { day: 4, hour: 17, minute: 0 } },
      { open: { day: 5, hour: 10, minute: 0 }, close: { day: 5, hour: 17, minute: 0 } },
      { open: { day: 6, hour: 10, minute: 0 }, close: { day: 6, hour: 17, minute: 0 } },
      { open: { day: 0, hour: 10, minute: 0 }, close: { day: 0, hour: 17, minute: 0 } },
    ],
  };

  it("rankTopActivitiesFromPlaces maps regularOpeningHours onto TopActivity", () => {
    const places: PlacesSearchTextPlace[] = [
      {
        id: "museum-hours",
        displayName: { text: "Boise Hands-On Museum" },
        rating: 4.6,
        userRatingCount: 2000,
        types: ["museum"],
        primaryType: "museum",
        location: { latitude: 43.6, longitude: -116.2 },
        regularOpeningHours: closedTuePeriods,
      },
    ];
    const ranked = rankTopActivitiesFromPlaces(places, { kind: "attraction" });
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.hoursByWeekday?.[2]).toBeNull();
    expect(ranked[0]!.hoursByWeekday?.[3]).toEqual({ open: "10:00", close: "17:00" });
  });

  it("landmarksFromPlacesResults stamps Text Search hours for closed-day filtering", () => {
    const ranked = rankTopActivitiesFromPlaces(
      [
        {
          id: "ChIJBoiseHandsOnMuseum0001",
          displayName: { text: "Boise Hands-On Museum" },
          rating: 4.6,
          userRatingCount: 2000,
          types: ["museum"],
          location: { latitude: 43.6, longitude: -116.2 },
          regularOpeningHours: closedTuePeriods,
        },
        {
          id: "park-open",
          displayName: { text: "Julia Davis Park" },
          rating: 4.7,
          userRatingCount: 3000,
          types: ["park"],
          location: { latitude: 43.61, longitude: -116.21 },
          // no regularOpeningHours — tag defaults only
        },
      ],
      { kind: "attraction", maxResults: 10 },
    );

    const landmarks = landmarksFromPlacesResults([
      { category: "Interactive Museums", places: ranked },
    ]);
    const museum = landmarks.find((l) => l.name === "Boise Hands-On Museum")!;
    const park = landmarks.find((l) => l.name === "Julia Davis Park")!;

    expect(museum.hoursByWeekday?.[2]).toBeNull();
    expect(hoursForDate(museum, "2026-08-11")).toBeNull(); // Tuesday
    expect(
      isLandmarkOpenForVisit(museum, {
        startMin: 10 * 60,
        endMin: 12 * 60,
        visitDate: "2026-08-11",
      }),
    ).toBe(false);
    expect(park.hoursByWeekday).toBeUndefined();
  });

  it("does not schedule a Text-Search-closed POI when an open alternative exists", () => {
    const placesSchedule = hoursByWeekdayFromRegularOpeningHours(closedTuePeriods)!;
    const closedMuseum: Landmark = {
      name: "Boise Hands-On Museum",
      lat: 43.6,
      lng: -116.2,
      adultPrice: 15,
      openingHours: { open: "10:00", close: "17:00" },
      hoursByWeekday: placesSchedule,
      intensity: "low",
      ageTags: ["toddler", "child", "tween"],
      interestTags: ["interactive"],
      indoor: true,
      placeId: "ChIJBoiseHandsOnMuseum0001",
    };

    const alwaysOpenPark: Landmark = {
      name: "Julia Davis Park",
      lat: 43.61,
      lng: -116.21,
      adultPrice: 0,
      openingHours: { open: "06:00", close: "20:00" },
      intensity: "low",
      ageTags: ["toddler", "child", "tween", "teen"],
      interestTags: ["parks"],
      indoor: false,
    };

    const city: CityConfig = {
      id: "places:boise",
      name: "Boise",
      country: "US",
      currency: "USD",
      currencySymbol: "$",
      lat: 43.6,
      lng: -116.2,
      aliases: ["boise"],
      transitQuality: "limited",
      taxiProviders: [{ name: "uber", label: "Uber", multiplier: 1 }],
      transport: {
        baseFare: 3,
        ratePerKm: 1,
        ratePerMin: 0.3,
        publicTransitDayPass: 6,
        publicTransitSingleRide: 2,
        fuelPricePerLiter: 1,
        avgFuelLitersPerDay: 8,
        parkingFeePerStop: 5,
      },
      food: { breakfast: 15, lunch: 25, dinner: 35 },
      landmarks: [closedMuseum, alwaysOpenPark],
    };

    const plan: TripPlan = {
      destination: "Boise, ID",
      startDate: "2026-08-11",
      endDate: "2026-08-11",
      adults: 2,
      children: [5],
      travelStyle: "balanced",
      walkingLimit: "medium",
      transportationType: "taxis",
      accommodationType: "hotel_no_breakfast",
      dietaryRestrictions: "",
      naps: [],
      budgetStyle: "balanced",
      interests: ["Interactive Museums", "Parks & Gardens"],
    };

    const pick = pickLandmarkForFamily(city, plan, 1, 0, [], {
      visitWindow: { startMin: 10 * 60, endMin: 12 * 60, visitDate: "2026-08-11" },
    });
    expect(pick.name).not.toBe("Boise Hands-On Museum");
    expect(pick.name).toBe("Julia Davis Park");
  });

  it("landmarkFromTopActivity carries Text Search hours onto the landmark", () => {
    const schedule = hoursByWeekdayFromRegularOpeningHours(closedTuePeriods)!;
    const landmark = landmarkFromTopActivity(
      {
        id: "ChIJHours",
        name: "Hours Museum",
        rating: 4.6,
        reviewCount: 2000,
        priceLevel: null,
        address: null,
        latitude: 1,
        longitude: 2,
        photoRef: null,
        score: 40,
        types: ["museum"],
        primaryType: "museum",
        websiteUri: null,
        hoursByWeekday: schedule,
      },
      ["museums"],
    );
    expect(landmark?.hoursByWeekday?.[2]).toBeNull();
    expect(landmark?.openingHours).toEqual({ open: "10:00", close: "17:00" });
  });
});
