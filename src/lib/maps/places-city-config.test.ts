import { describe, expect, it, vi, afterEach } from "vitest";
import { detectCity } from "@/lib/city-detect";
import { planTrip } from "@/lib/planning-engine";
import {
  adultPriceFromPriceLevel,
  buildCityConfigFromPlaces,
  interestTagsForSearchCategory,
  isCuratedCity,
  landmarkFromTopActivity,
  landmarksFromPlacesResults,
  placesSearchCategoriesFromInterests,
  resolvePlanningCity,
} from "@/lib/maps/places-city-config";
import { clearTopActivitiesCache } from "@/lib/maps/top-activities-cache";
import type { TopActivity } from "@/lib/maps/get-top-activities";
import { TripPlan } from "@/types/trip-plan";

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Dallas, TX",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    adults: 2,
    children: [6, 9],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Zoos & Aquariums", "Museums & Art"],
    ...overrides,
  };
}

function place(overrides: Partial<TopActivity> & Pick<TopActivity, "id" | "name">): TopActivity {
  return {
    rating: 4.6,
    reviewCount: 2000,
    priceLevel: "PRICE_LEVEL_MODERATE",
    address: "1 Main St",
    latitude: 32.78,
    longitude: -96.8,
    photoRef: null,
    score: 40,
    ...overrides,
  };
}

describe("places → CityConfig mapping (FAM-59)", () => {
  it("maps wizard interests to Places search categories", () => {
    expect(placesSearchCategoriesFromInterests(["Zoos & Aquariums", "Parks & Gardens"])).toEqual([
      "Zoos & Aquariums",
      "Parks & Gardens",
    ]);
    expect(interestTagsForSearchCategory("Zoos & Aquariums")).toEqual(["zoos"]);
  });

  it("maps TopActivity into a Landmark with place metadata", () => {
    const landmark = landmarkFromTopActivity(
      place({ id: "places/zoo", name: "Dallas Zoo" }),
      ["zoos"],
    );
    expect(landmark).toMatchObject({
      name: "Dallas Zoo",
      lat: 32.78,
      lng: -96.8,
      interestTags: ["zoos"],
      placeId: "places/zoo",
      rating: 4.6,
      adultPrice: adultPriceFromPriceLevel("PRICE_LEVEL_MODERATE"),
    });
  });

  it("dedupes landmarks across categories and merges tags", () => {
    const landmarks = landmarksFromPlacesResults([
      {
        category: "Zoos & Aquariums",
        places: [place({ id: "a", name: "Shared Spot", latitude: 1, longitude: 2 })],
      },
      {
        category: "Museums & Art",
        places: [place({ id: "a", name: "Shared Spot", latitude: 1, longitude: 2 })],
      },
    ]);
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]!.interestTags.sort()).toEqual(["museums", "zoos"].sort());
  });
});

describe("resolvePlanningCity curated vs Places (FAM-59)", () => {
  afterEach(() => {
    clearTopActivitiesCache();
    vi.restoreAllMocks();
  });

  it("keeps curated San Diego / Paris configs", async () => {
    const sd = await resolvePlanningCity(basePlan({ destination: "San Diego" }));
    expect(isCuratedCity(sd)).toBe(true);
    expect(sd.id).toBe("san-diego");
    expect(sd.landmarks.some((l) => l.name === "San Diego Zoo")).toBe(true);

    const paris = await resolvePlanningCity(basePlan({ destination: "Paris, France" }));
    expect(paris.id).toBe("paris");
  });

  it("builds a Places city for unknown destinations when enough POIs return", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: "1",
            displayName: { text: "Dallas Zoo" },
            rating: 4.6,
            userRatingCount: 5000,
            location: { latitude: 32.74, longitude: -96.81 },
          },
          {
            id: "2",
            displayName: { text: "Perot Museum" },
            rating: 4.7,
            userRatingCount: 8000,
            location: { latitude: 32.78, longitude: -96.8 },
          },
          {
            id: "3",
            displayName: { text: "Klyde Warren Park" },
            rating: 4.8,
            userRatingCount: 9000,
            location: { latitude: 32.79, longitude: -96.8 },
          },
          {
            id: "4",
            displayName: { text: "Dallas Arboretum" },
            rating: 4.8,
            userRatingCount: 12000,
            location: { latitude: 32.82, longitude: -96.71 },
          },
        ],
      }),
    });

    const city = await buildCityConfigFromPlaces("Dallas, TX", ["Zoos & Aquariums", "Museums & Art"], {
      env: { GOOGLE_PLACES_API_KEY: "test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(city).not.toBeNull();
    expect(city!.id.startsWith("places:")).toBe(true);
    expect(city!.landmarks.map((l) => l.name)).toEqual(
      expect.arrayContaining(["Dallas Zoo", "Perot Museum"]),
    );
    expect(city!.landmarks.every((l) => l.name !== "City Center Park")).toBe(true);
  });

  it("falls back when Places returns too few landmarks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: "1",
            displayName: { text: "Only One" },
            rating: 4.6,
            userRatingCount: 500,
            location: { latitude: 1, longitude: 2 },
          },
        ],
      }),
    });

    const city = await buildCityConfigFromPlaces("Nowhere", ["Parks & Gardens"], {
      env: { GOOGLE_PLACES_API_KEY: "test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minLandmarks: 4,
    });
    expect(city).toBeNull();
  });

  it("planTrip with Places cityOverride schedules real names, not DEFAULT fakes", () => {
    const detected = detectCity("Dallas, TX");
    expect(detected.id).toBe("default");

    const placesCity = {
      ...detected,
      id: "places:dallas",
      name: "Dallas",
      landmarks: [
        landmarkFromTopActivity(place({ id: "1", name: "Dallas Zoo", latitude: 32.7, longitude: -96.8 }), [
          "zoos",
        ])!,
        landmarkFromTopActivity(
          place({ id: "2", name: "Perot Museum", latitude: 32.78, longitude: -96.81 }),
          ["museums"],
        )!,
        landmarkFromTopActivity(
          place({ id: "3", name: "Klyde Warren Park", latitude: 32.79, longitude: -96.8 }),
          ["parks"],
        )!,
        landmarkFromTopActivity(
          place({ id: "4", name: "Dallas Arboretum", latitude: 32.82, longitude: -96.7 }),
          ["parks", "nature"],
        )!,
      ],
    };

    const { raw } = planTrip(basePlan(), { cityOverride: placesCity });
    const titles = raw.days.flatMap((d) => d.activities.map((a) => a.title)).join("\n");
    expect(titles).not.toMatch(/City Center Park|Family Museum|Waterfront Promenade/);
    expect(titles).toMatch(/Dallas Zoo|Perot Museum|Klyde Warren|Arboretum/);
  });

  it("curated Paris planTrip ignores Places and keeps Louvre-class stops", () => {
    const { raw } = planTrip(basePlan({ destination: "Paris", interests: ["Museums & Art"] }));
    const titles = raw.days.flatMap((d) => d.activities.map((a) => a.title)).join("\n");
    expect(titles).toMatch(/Louvre|Eiffel|Luxembourg|Jardin|Montmartre|Cité/i);
  });
});
