import { describe, expect, it } from "vitest";
import { DEFAULT_CITY } from "@/config/city-pricing";
import {
  detectCity,
  detectCityFromPlan,
  hasResolvedDestinationCenter,
} from "./city-detect";

describe("detectCity destination center", () => {
  it("keeps curated San Diego coords", () => {
    const city = detectCity("San Diego, CA");
    expect(city.id).toBe("san-diego");
    expect(city.lat).toBeCloseTo(32.7157, 2);
    expect(city.lng).toBeCloseTo(-117.1611, 2);
  });

  it("uses Texas coords for Dallas instead of DEFAULT_CITY New York (FAM-57)", () => {
    const city = detectCity("Dallas, TX");
    expect(city.id).toBe("default");
    expect(city.name).toBe("Dallas");
    expect(city.lat).not.toBeCloseTo(DEFAULT_CITY.lat, 1);
    expect(city.lng).not.toBeCloseTo(DEFAULT_CITY.lng, 1);
    expect(city.lat).toBeCloseTo(32.7767, 2);
    expect(city.lng).toBeCloseTo(-96.797, 2);
  });

  it("falls back to DEFAULT coords for unknown destinations without a Places center", () => {
    const city = detectCity("Somewhereville, ZZ");
    expect(city.id).toBe("default");
    expect(city.name).toBe("Somewhereville");
    expect(city.lat).toBe(DEFAULT_CITY.lat);
    expect(city.lng).toBe(DEFAULT_CITY.lng);
  });

  it("prefers Places-resolved plan coords over DEFAULT for unknown cities", () => {
    const city = detectCityFromPlan({
      destination: "Boise, ID, USA",
      destinationLat: 43.615,
      destinationLng: -116.2023,
    });
    expect(city.name).toMatch(/Boise/i);
    expect(city.lat).toBeCloseTo(43.615, 2);
    expect(city.lng).toBeCloseTo(-116.2023, 2);
    expect(city.lat).not.toBeCloseTo(DEFAULT_CITY.lat, 1);
  });
});

describe("hasResolvedDestinationCenter", () => {
  it("requires a label plus finite lat/lng", () => {
    expect(hasResolvedDestinationCenter({ destination: "Boise" })).toBe(false);
    expect(
      hasResolvedDestinationCenter({
        destination: "Boise",
        destinationLat: 43.6,
        destinationLng: null,
      }),
    ).toBe(false);
    expect(
      hasResolvedDestinationCenter({
        destination: "Boise, ID",
        destinationLat: 43.615,
        destinationLng: -116.2023,
      }),
    ).toBe(true);
  });
});
