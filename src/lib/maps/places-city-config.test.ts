import { describe, expect, it, vi, afterEach } from "vitest";
import { detectCity } from "@/lib/city-detect";
import { planTrip } from "@/lib/planning-engine";
import {
  adultPriceFromPriceLevel,
  ageTagsForPlaceName,
  buildCityConfigFromPlaces,
  interestTagsForSearchCategory,
  isCuratedCity,
  landmarkFromTopActivity,
  landmarksFromPlacesResults,
  placesSearchCategoriesFromInterests,
  placesRestaurantSearchPlans,
  refineInterestTagsForPlaceName,
  restaurantFromTopActivity,
  resolvePlanningCity,
} from "@/lib/maps/places-city-config";
import { clearDestinationCenterCache } from "@/lib/maps/resolve-destination-center";
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
    types: ["tourist_attraction"],
    primaryType: "tourist_attraction",
    websiteUri: null,
    hoursByWeekday: null,
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
    expect(placesSearchCategoriesFromInterests(["Animal Experiences"])).toEqual([
      "petting zoo animal sanctuary farm animals horseback riding",
    ]);
    expect(
      interestTagsForSearchCategory("petting zoo animal sanctuary farm animals horseback riding"),
    ).toEqual(["animal-experiences"]);
    expect(placesSearchCategoriesFromInterests(["Tours & Sightseeing"])).toEqual([
      "hop on hop off sightseeing tour boat cruise guided tour",
    ]);
    expect(
      interestTagsForSearchCategory("hop on hop off sightseeing tour boat cruise guided tour"),
    ).toEqual(["tours"]);
    expect(placesSearchCategoriesFromInterests(["Spas"])).toEqual([
      "family spa hot springs thermal baths wellness",
    ]);
    expect(placesSearchCategoriesFromInterests(["Interactive Museums"])).toEqual([
      "science museum children's museum interactive exhibits",
    ]);
    expect(
      interestTagsForSearchCategory("science museum children's museum interactive exhibits"),
    ).toEqual(["interactive"]);
    expect(placesSearchCategoriesFromInterests(["Shopping"])).toEqual([
      "shopping mall outlet center premium outlets galleria",
    ]);
    expect(
      interestTagsForSearchCategory("shopping mall outlet center premium outlets galleria"),
    ).toEqual(["shopping"]);
  });

  it("uses kid-oriented Places queries for young children (FAM age fit)", () => {
    expect(
      placesSearchCategoriesFromInterests(
        ["Shows & Entertainment", "Sports & Recreation", "Museums & Art"],
        { youngestChildAge: 3 },
      ),
    ).toEqual([
      "children's theater family show puppet show kids entertainment magic show",
      "family recreation center kids sports ice skating bowling community center",
      "family art museum gallery painting kids art",
    ]);
    expect(
      interestTagsForSearchCategory(
        "children's theater family show puppet show kids entertainment magic show",
      ),
    ).toEqual(["entertainment"]);
  });

  it("refines petting zoos, tours, and hybrid water parks to the taxonomy tags", () => {
    expect(refineInterestTagsForPlaceName("County Petting Zoo", ["zoos"])).toEqual([
      "animal-experiences",
    ]);
    expect(refineInterestTagsForPlaceName("Old Town Trolley Tour", ["history"])).toEqual(["tours"]);
    expect(refineInterestTagsForPlaceName("Hawaiian Falls Water Park", ["theme-parks"])).toEqual([
      "beaches",
    ]);
    expect(refineInterestTagsForPlaceName("Disney's Typhoon Lagoon", ["theme-parks"])).toContain(
      "theme-parks",
    );
  });

  it("strips shopping tags from strip centers and generic plazas", () => {
    expect(refineInterestTagsForPlaceName("The Hill", ["shopping"])).toEqual(["parks"]);
    expect(refineInterestTagsForPlaceName("The Shops at Park Lane", ["shopping"])).toEqual([
      "parks",
    ]);
    expect(refineInterestTagsForPlaceName("Lincoln Park", ["shopping"])).toEqual(["parks"]);
    expect(refineInterestTagsForPlaceName("NorthPark Center", ["shopping"])).toEqual(["shopping"]);
    expect(refineInterestTagsForPlaceName("Dallas Premium Outlets", ["shopping"])).toEqual([
      "shopping",
    ]);
  });

  it("tags adult theaters/opera as tween/teen, not toddler/child", () => {
    expect(ageTagsForPlaceName("Dallas Opera", ["entertainment"])).toEqual(["tween", "teen"]);
    expect(ageTagsForPlaceName("Majestic Theatre", ["entertainment"])).toEqual(["tween", "teen"]);
    expect(ageTagsForPlaceName("The Bomb Factory", ["entertainment"])).toEqual(["tween", "teen"]);
    expect(ageTagsForPlaceName("Children's Theater of Dallas", ["entertainment"])).toEqual([
      "toddler",
      "child",
      "tween",
    ]);
    expect(ageTagsForPlaceName("Nasher Sculpture Center", ["museums"])).toEqual([
      "child",
      "tween",
      "teen",
    ]);
    expect(ageTagsForPlaceName("Paint Your Own Pottery Studio", ["museums"])).toEqual([
      "toddler",
      "child",
      "tween",
    ]);
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
    expect(landmark?.minAge).toBeUndefined();
    expect(landmark?.maxAge).toBeUndefined();
    expect(landmark?.hoursConfidence).toBe("assumed");
  });

  it("copies Places weekday hours onto restaurants and never infers age limits", () => {
    const restaurant = restaurantFromTopActivity(
      place({
        id: "places/vegan",
        name: "Neighborhood Grill",
        hoursByWeekday: { 0: { open: "11:00", close: "21:00" }, 1: null },
        reviewSnippets: ["Great vegan options for the kids."],
      }),
    );
    expect(restaurant?.hoursByWeekday?.[0]).toEqual({ open: "11:00", close: "21:00" });
    expect(restaurant?.dietaryOptions).toContain("vegan");
    expect(restaurant?.minAge).toBeUndefined();
    expect(restaurant?.maxAge).toBeUndefined();
  });

  it("treats shopping malls as free entry (Places priceLevel is for shops, not tickets)", () => {
    const mall = landmarkFromTopActivity(
      place({
        id: "outlets",
        name: "Denver Premium Outlets",
        priceLevel: "PRICE_LEVEL_EXPENSIVE",
        types: ["shopping_mall"],
        primaryType: "shopping_mall",
        websiteUri: "https://example.com",
      }),
      ["shopping"],
    );
    expect(mall?.interestTags).toContain("shopping");
    expect(mall?.adultPrice).toBe(0);
  });

  it("maps TopActivity into a CityRestaurant (FAM-58)", () => {
    const restaurant = restaurantFromTopActivity(
      place({
        id: "places/bbq",
        name: "Pecan Lodge",
        priceLevel: "PRICE_LEVEL_MODERATE",
        reviewCount: 4200,
      }),
      ["vegan"],
    );
    expect(restaurant).toMatchObject({
      name: "Pecan Lodge",
      lat: 32.78,
      lng: -96.8,
      meals: ["lunch", "dinner"],
      placeId: "places/bbq",
      rating: 4.6,
      reviewCount: 4200,
      dietary: ["vegan"],
      budgetStyles: ["save", "balanced", "splurge"],
    });
  });

  it("does not treat a bakeshop as a dinner restaurant", () => {
    const bakery = restaurantFromTopActivity(
      place({
        id: "places/bake",
        name: "Oak Lawn Bakeshop",
        types: ["bakery", "cafe"],
        primaryType: "bakery",
      }),
    );
    expect(bakery?.meals).toEqual(["breakfast"]);
    expect(bakery?.meals).not.toContain("dinner");
  });

  it("searches vegan Places categories when dietaryRestrictions include vegan", () => {
    expect(placesRestaurantSearchPlans("Vegan")).toEqual([
      { category: "vegan restaurants", dietary: ["vegan"] },
      { category: "vegan cafes", dietary: ["vegan"] },
    ]);
    expect(placesRestaurantSearchPlans("")).toEqual([
      { category: "family restaurants", dietary: [] },
    ]);
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

  it("marks arcades as tween/teen only and indoor play as toddler/child", () => {
    const arcade = landmarkFromTopActivity(
      place({ id: "arcade", name: "Dallas Arcade Palace" }),
      ["entertainment"],
    );
    const softPlay = landmarkFromTopActivity(
      place({ id: "play", name: "Kids Empire Dallas Hillcrest" }),
      ["indoor-play", "playgrounds"],
    );
    expect(arcade?.ageTags).toEqual(["tween", "teen"]);
    expect(softPlay?.ageTags).toEqual(["toddler", "child"]);
  });

  it("does not treat adult concert venues as all-ages entertainment", () => {
    const opera = landmarkFromTopActivity(place({ id: "opera", name: "Dallas Opera" }), [
      "entertainment",
    ]);
    const bomb = landmarkFromTopActivity(
      place({
        id: "bomb",
        name: "The Bomb Factory",
        types: ["performing_arts_theater"],
        primaryType: "performing_arts_theater",
      }),
      ["entertainment"],
    );
    expect(opera?.ageTags).toEqual(["tween", "teen"]);
    expect(bomb?.ageTags).toEqual(["tween", "teen"]);
  });

  it("does not tag city parks or soft play as theme parks", () => {
    const fromThemeSearch = landmarksFromPlacesResults([
      {
        category: "Theme Parks",
        places: [
          place({ id: "1", name: "Klyde Warren Park", latitude: 32.79, longitude: -96.8 }),
          place({
            id: "2",
            name: "Kids Empire Dallas Hillcrest",
            latitude: 32.84,
            longitude: -96.78,
          }),
          place({ id: "3", name: "Six Flags Over Texas", latitude: 32.75, longitude: -97.07 }),
        ],
      },
    ]);
    const byName = Object.fromEntries(fromThemeSearch.map((l) => [l.name, l.interestTags]));
    expect(byName["Klyde Warren Park"]).toEqual(["parks"]);
    expect(byName["Klyde Warren Park"]).not.toContain("theme-parks");
    expect(byName["Kids Empire Dallas Hillcrest"]).toContain("indoor-play");
    expect(byName["Kids Empire Dallas Hillcrest"]).not.toContain("theme-parks");
    expect(byName["Kids Empire Dallas Hillcrest"]).not.toContain("playgrounds");
    expect(byName["Six Flags Over Texas"]).toContain("theme-parks");
  });

  it("tags Fritz's Adventure / DINO KIDZ as indoor-play, not playgrounds or theme parks", () => {
    const landmarks = landmarksFromPlacesResults([
      {
        category: "Indoor & Outdoor Play",
        places: [
          place({
            id: "1",
            name: "Fritz's Adventure - The Colony",
            latitude: 33.08,
            longitude: -96.88,
          }),
          place({
            id: "2",
            name: "DINO KIDZ - Castle Hills",
            latitude: 33.0,
            longitude: -96.9,
          }),
        ],
      },
    ]);
    const byName = Object.fromEntries(landmarks.map((l) => [l.name, l.interestTags]));
    expect(byName["Fritz's Adventure - The Colony"]).toEqual(["indoor-play"]);
    expect(byName["DINO KIDZ - Castle Hills"]).toEqual(["indoor-play"]);
  });

  it("keeps art museums out of interactive and beaches free", () => {
    const landmarks = landmarksFromPlacesResults([
      {
        category: "Interactive Museums",
        places: [
          place({ id: "1", name: "Nasher Sculpture Center", latitude: 32.78, longitude: -96.8 }),
          place({
            id: "2",
            name: "Perot Museum of Nature and Science",
            latitude: 32.78,
            longitude: -96.8,
          }),
        ],
      },
      {
        category: "Beaches & Waterfronts",
        places: [
          place({
            id: "3",
            name: "Little Elm Beach",
            latitude: 33.16,
            longitude: -96.93,
            priceLevel: "PRICE_LEVEL_EXPENSIVE",
          }),
        ],
      },
    ]);
    const byName = Object.fromEntries(landmarks.map((l) => [l.name, l]));
    expect(byName["Nasher Sculpture Center"]!.interestTags).not.toContain("interactive");
    expect(byName["Nasher Sculpture Center"]!.interestTags).toContain("museums");
    expect(byName["Perot Museum of Nature and Science"]!.interestTags).toContain("interactive");
    expect(byName["Little Elm Beach"]!.adultPrice).toBe(0);
    expect(byName["Little Elm Beach"]!.interestTags).toContain("beaches");
  });
});

describe("resolvePlanningCity curated vs Places (FAM-59)", () => {
  afterEach(() => {
    clearTopActivitiesCache();
    clearDestinationCenterCache();
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
    expect(city!.restaurants?.some((r) => r.name === "Dallas Zoo")).toBe(true);
    const body = JSON.parse(String((fetchImpl.mock.calls[0]![1] as RequestInit).body)) as {
      locationBias?: { circle?: { center?: { latitude?: number; longitude?: number } } };
    };
    expect(body.locationBias?.circle?.center?.latitude).toBeCloseTo(32.7767, 2);
    expect(body.locationBias?.circle?.center?.longitude).toBeCloseTo(-96.797, 2);
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
