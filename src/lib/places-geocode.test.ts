import { describe, expect, it } from "vitest";
import { enrichQuery, geocodeStay } from "@/lib/places-geocode";

describe("places-geocode — FAM-24 free-text stay", () => {
  it("appends the destination city when missing from the query", () => {
    expect(enrichQuery("Marriott Downtown", "Paris")).toBe("Marriott Downtown, Paris");
    expect(enrichQuery("12 Rue de Rivoli, Paris", "Paris")).toBe("12 Rue de Rivoli, Paris");
  });

  it("falls back to city center when Google is unavailable", async () => {
    const resolved = await geocodeStay({
      query: "Family Airbnb",
      city: "Paris",
      lat: 48.8566,
      lng: 2.3522,
      apiKey: null,
    });
    expect(resolved.source).toBe("city");
    expect(resolved.lat).toBe(48.8566);
    expect(resolved.lng).toBe(2.3522);
    expect(resolved.address).toBe("Family Airbnb");
  });
});
