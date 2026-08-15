import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activityScore,
  getTopActivities,
  PlacesApiError,
  rankTopActivitiesFromPlaces,
  type PlacesSearchTextPlace,
} from "@/lib/maps/get-top-activities";
import {
  clearTopActivitiesCache,
  getOrFetchTopActivities,
} from "@/lib/maps/top-activities-cache";

const samplePlaces: PlacesSearchTextPlace[] = [
  {
    id: "low-reviews",
    displayName: { text: "Tiny Spot" },
    rating: 5,
    userRatingCount: 10,
  },
  {
    id: "low-rating",
    displayName: { text: "Meh Museum" },
    rating: 4.0,
    userRatingCount: 5000,
  },
  {
    id: "zoo-a",
    displayName: { text: "Famous Zoo" },
    rating: 4.6,
    userRatingCount: 3000,
    priceLevel: "PRICE_LEVEL_MODERATE",
    formattedAddress: "1 Zoo Rd",
    location: { latitude: 32.7, longitude: -117.1 },
    photos: [{ name: "places/zoo-a/photos/1" }],
  },
  {
    id: "zoo-b",
    displayName: { text: "Quiet Zoo" },
    rating: 4.9,
    userRatingCount: 200,
    location: { latitude: 32.8, longitude: -117.2 },
  },
];

describe("rankTopActivitiesFromPlaces (FAM-58 / FAM-60)", () => {
  it("filters by min rating and review count, then ranks by score", () => {
    const ranked = rankTopActivitiesFromPlaces(samplePlaces, 10);
    expect(ranked.map((p) => p.id)).toEqual(["zoo-a", "zoo-b"]);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    expect(ranked[0]!.name).toBe("Famous Zoo");
    expect(ranked[0]!.photoRef).toBe("places/zoo-a/photos/1");
    expect(ranked[0]!.score).toBe(activityScore(4.6, 3000));
  });

  it("respects maxResults", () => {
    expect(rankTopActivitiesFromPlaces(samplePlaces, 1)).toHaveLength(1);
  });
});

describe("getTopActivities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when no API key is configured", async () => {
    await expect(getTopActivities("San Diego", "zoos", { env: {} })).resolves.toEqual([]);
  });

  it("calls Places searchText and maps the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: samplePlaces }),
    });

    const places = await getTopActivities("San Diego", "zoos", {
      env: { GOOGLE_PLACES_API_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "X-Goog-Api-Key": "test-key",
    });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      textQuery: "zoos in San Diego",
    });
    expect(places.map((p) => p.id)).toEqual(["zoo-a", "zoo-b"]);
  });

  it("sends locationBias when a destination center is provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    await getTopActivities("Dallas, TX", "zoos", {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      location: { lat: 32.7767, lng: -96.797, radiusMeters: 35_000 },
    });
    expect(JSON.parse(String((fetchImpl.mock.calls[0]![1] as RequestInit).body))).toEqual({
      textQuery: "zoos in Dallas, TX",
      locationBias: {
        circle: {
          center: { latitude: 32.7767, longitude: -96.797 },
          radius: 35_000,
        },
      },
    });
  });

  it("falls back to GOOGLE_MAPS_API_KEY", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    await getTopActivities("Paris", "museums", {
      env: { GOOGLE_MAPS_API_KEY: "maps-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect((fetchImpl.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      "X-Goog-Api-Key": "maps-key",
    });
  });

  it("throws PlacesApiError on non-OK responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "denied",
    });
    await expect(
      getTopActivities("San Diego", "zoos", {
        env: { GOOGLE_PLACES_API_KEY: "k" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(PlacesApiError);
  });
});

describe("getOrFetchTopActivities cache (FAM-61)", () => {
  afterEach(() => {
    clearTopActivitiesCache();
    vi.restoreAllMocks();
  });

  it("does not re-hit Google within TTL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: samplePlaces }),
    });
    const opts = {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1_000_000,
      ttlMs: 60_000,
    };

    const first = await getOrFetchTopActivities("San Diego", "Zoos", opts);
    const second = await getOrFetchTopActivities("san diego", "zoos", opts);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.places).toEqual(first.places);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("refetches after TTL expires", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: samplePlaces }),
    });
    let now = 1_000_000;
    const opts = {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => now,
      ttlMs: 1_000,
    };

    await getOrFetchTopActivities("San Diego", "zoos", opts);
    now += 2_000;
    const second = await getOrFetchTopActivities("San Diego", "zoos", opts);

    expect(second.cached).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent lookups for the same city and category", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const opts = {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };

    const first = getOrFetchTopActivities("Boise", "parks", opts);
    const second = getOrFetchTopActivities("boise", "Parks", opts);
    expect(fetchImpl).toHaveBeenCalledOnce();

    resolveFetch?.({
      ok: true,
      json: async () => ({ places: samplePlaces }),
    });

    const [a, b] = await Promise.all([first, second]);
    expect(a.cached).toBe(false);
    expect(b.places).toEqual(a.places);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
