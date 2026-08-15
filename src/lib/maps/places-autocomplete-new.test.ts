import { describe, expect, it, vi } from "vitest";
import {
  autocompletePlacesNew,
  barePlaceId,
  fetchPlaceDetailsNew,
} from "./places-autocomplete-new";

describe("Places Autocomplete (New)", () => {
  it("normalizes places/ resource names to bare ids", () => {
    expect(barePlaceId("places/ChIJabc")).toBe("ChIJabc");
    expect(barePlaceId("ChIJabc")).toBe("ChIJabc");
  });

  it("maps city predictions for queries like Boise / Jerusalem", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              place: "places/ChIJ-boise",
              placeId: "ChIJ-boise",
              text: { text: "Boise, ID, USA" },
            },
          },
          {
            placePrediction: {
              placeId: "ChIJ-jerusalem",
              text: { text: "Jerusalem, Israel" },
            },
          },
        ],
      }),
    });

    const suggestions = await autocompletePlacesNew({
      input: "boise",
      includedPrimaryTypes: ["(cities)"],
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:autocomplete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(suggestions).toEqual([
      { label: "Boise, ID, USA", placeId: "ChIJ-boise" },
      { label: "Jerusalem, Israel", placeId: "ChIJ-jerusalem" },
    ]);
  });

  it("returns empty on API error without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "denied",
    });
    const suggestions = await autocompletePlacesNew({
      input: "oslo",
      apiKey: "bad",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(suggestions).toEqual([]);
  });
});

describe("Places Details (New)", () => {
  it("returns lat/lng for a place id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "places/ChIJ-oslo",
        formattedAddress: "Oslo, Norway",
        location: { latitude: 59.9139, longitude: 10.7522 },
      }),
    });

    const details = await fetchPlaceDetailsNew("places/ChIJ-oslo", {
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(details).toEqual({
      placeId: "ChIJ-oslo",
      address: "Oslo, Norway",
      lat: 59.9139,
      lng: 10.7522,
    });
  });
});
