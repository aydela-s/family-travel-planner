import { beforeEach, describe, expect, it, vi } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { buildRouteSegments } from "@/lib/maps/route-segments";
import { initialTripPlan, type TripPlan } from "@/types/trip-plan";
import type { ItineraryActivity } from "@/types/itinerary";

const getDirectionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/maps/directions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/directions")>();
  return {
    ...actual,
    getDirections: getDirectionsMock,
  };
});

describe("buildRouteSegments", () => {
  const city = CITY_CONFIGS[0]!;

  beforeEach(() => {
    getDirectionsMock.mockReset();
    getDirectionsMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return {
        distanceKm: 2,
        durationMin: 8,
        cost: 12,
        provider: "Uber",
        source: "google" as const,
      };
    });
  });

  it("fetches distinct legs in parallel (wall time ~ one RTT, not N)", async () => {
    const plan: TripPlan = {
      ...initialTripPlan,
      destination: city.name,
      transportationType: "taxis",
      stayAddress: "Test Hotel",
      stayLat: city.lat,
      stayLng: city.lng,
      stayPlaceId: "places/test-hotel",
    };

    const landmarks = city.landmarks.slice(0, 3);
    const activities: ItineraryActivity[] = landmarks.map((l, i) => ({
      time: `${9 + i * 2}:00 AM`,
      title: l.name,
      type: "activity" as const,
      location: { name: l.name, lat: l.lat, lng: l.lng },
    }));

    const started = performance.now();
    const result = await buildRouteSegments(activities, city, plan);
    const elapsed = performance.now() - started;

    // Stay → A → B → C → stay = 4 legs when stay is set and distinct from stops.
    expect(getDirectionsMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(result.routeSegments.length).toBe(getDirectionsMock.mock.calls.length);
    // Sequential would be ~25ms * N; parallel should finish well under that.
    const sequentialFloor = 25 * getDirectionsMock.mock.calls.length * 0.85;
    expect(elapsed).toBeLessThan(sequentialFloor);
  });
});
