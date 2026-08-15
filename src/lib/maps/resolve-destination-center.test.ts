import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CITY } from "@/config/city-pricing";
import {
  applyDestinationCenter,
  clearDestinationCenterCache,
  coordsMatchDefaultCity,
  resolveDestinationCenter,
} from "@/lib/maps/resolve-destination-center";
import { initialTripPlan, type TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    ...initialTripPlan,
    destination: "Boise, ID, USA",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    ...overrides,
  };
}

function placesFetchImpl() {
  return vi.fn(async (url: string) => {
    if (String(url).includes("places:autocomplete")) {
      return {
        ok: true,
        json: async () => ({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ-boise",
                text: { text: "Boise, ID, USA" },
              },
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        id: "places/ChIJ-boise",
        formattedAddress: "Boise, ID, USA",
        location: { latitude: 43.615, longitude: -116.2023 },
      }),
    };
  });
}

describe("resolveDestinationCenter (FAM-57)", () => {
  afterEach(() => {
    clearDestinationCenterCache();
    vi.restoreAllMocks();
  });

  it("reuses wizard destinationLat/Lng without calling Places", async () => {
    const fetchImpl = vi.fn();
    const center = await resolveDestinationCenter(
      plan({
        destinationLat: 43.615,
        destinationLng: -116.2023,
      }),
      { env: { GOOGLE_PLACES_API_KEY: "k" }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(center).toEqual({ lat: 43.615, lng: -116.2023, source: "plan" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses catalog coords for Dallas without a CITY_CONFIGS entry", async () => {
    const fetchImpl = vi.fn();
    const center = await resolveDestinationCenter(plan({ destination: "Dallas, TX" }), {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(center.source).toBe("catalog");
    expect(center.lat).toBeCloseTo(32.7767, 2);
    expect(center.lng).toBeCloseTo(-96.797, 2);
    expect(center.lat).not.toBeCloseTo(DEFAULT_CITY.lat, 1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("geocodes an unknown city via Places Autocomplete + Details", async () => {
    const fetchImpl = placesFetchImpl();
    const center = await resolveDestinationCenter(plan(), {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(center).toEqual({ lat: 43.615, lng: -116.2023, source: "places" });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("uses Place Details when destinationPlaceId is already on the plan", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toContain("places/ChIJ-boise");
      return {
        ok: true,
        json: async () => ({
          id: "ChIJ-boise",
          location: { latitude: 43.615, longitude: -116.2023 },
        }),
      };
    });
    const center = await resolveDestinationCenter(
      plan({ destinationPlaceId: "ChIJ-boise" }),
      { env: { GOOGLE_PLACES_API_KEY: "k" }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(center.source).toBe("places");
    expect(center.lat).toBeCloseTo(43.615, 2);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("fails soft to DEFAULT_CITY when Places is unavailable", async () => {
    const center = await resolveDestinationCenter(plan({ destination: "Somewhereville, ZZ" }), {
      env: {},
    });
    expect(center.source).toBe("default");
    expect(center.lat).toBe(DEFAULT_CITY.lat);
    expect(center.lng).toBe(DEFAULT_CITY.lng);
    expect(coordsMatchDefaultCity(center.lat, center.lng)).toBe(true);
  });

  it("does not re-hit Places for the same city within TTL", async () => {
    const fetchImpl = placesFetchImpl();
    const opts = {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1_000_000,
      ttlMs: 60_000,
    };
    const first = await resolveDestinationCenter(plan(), opts);
    const callsAfterFirst = fetchImpl.mock.calls.length;
    const second = await resolveDestinationCenter(plan(), opts);
    expect(first.source).toBe("places");
    expect(second).toEqual(first);
    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it("applyDestinationCenter stamps coords onto a plan that lacked them", async () => {
    const fetchImpl = placesFetchImpl();
    const next = await applyDestinationCenter(plan(), {
      env: { GOOGLE_PLACES_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(next.destinationLat).toBeCloseTo(43.615, 2);
    expect(next.destinationLng).toBeCloseTo(-116.2023, 2);
  });
});
