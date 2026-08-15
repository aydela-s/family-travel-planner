import { describe, expect, it } from "vitest";
import {
  coordsForDestinationPick,
  rankStaySuggestionsByDestination,
  resolveDestinationBias,
} from "@/lib/destination-bias";

describe("destination bias — stay autocomplete", () => {
  it("resolves Dallas to Texas-area coordinates", () => {
    const bias = resolveDestinationBias("Dallas");
    expect(bias.cityName).toBe("Dallas");
    expect(bias.country).toBe("US");
    expect(bias.lat).toBeCloseTo(32.78, 1);
    expect(bias.lng).toBeCloseTo(-96.8, 1);
  });

  it("resolves Paris from a longer destination label", () => {
    const bias = resolveDestinationBias("Paris, France");
    expect(bias.cityName).toBe("Paris");
    expect(bias.country).toBe("FR");
    expect(typeof bias.lat).toBe("number");
    expect(typeof bias.lng).toBe("number");
  });

  it("falls back to the typed city name when unknown", () => {
    const bias = resolveDestinationBias("Somewhereville, ZZ");
    expect(bias.cityName).toBe("Somewhereville");
    expect(bias.lat).toBeUndefined();
  });

  it("ranks suggestions that mention the destination city first", () => {
    const ranked = rankStaySuggestionsByDestination(
      [
        { label: "Marriott Downtown, Oklahoma City, OK, USA" },
        { label: "Marriott Downtown, Dallas, TX, USA" },
        { label: "Hilton Anatole, Dallas, TX, USA" },
      ],
      "Dallas",
    );
    expect(ranked[0]?.label).toMatch(/Dallas/i);
    expect(ranked[1]?.label).toMatch(/Dallas/i);
    expect(ranked[2]?.label).toMatch(/Oklahoma/i);
  });
});

describe("coordsForDestinationPick", () => {
  it("resolves Dallas instantly from the local catalog id", () => {
    const coords = coordsForDestinationPick("Dallas, USA", "dallas");
    expect(coords).toEqual({ lat: 32.7767, lng: -96.797 });
  });

  it("resolves from a Google-style label via popular bias without waiting on Details", () => {
    const coords = coordsForDestinationPick("Dallas, TX, USA", "ChIJS5dFe_cZTIYRj2dH9qSb7Lk");
    expect(coords?.lat).toBeCloseTo(32.7767, 2);
    expect(coords?.lng).toBeCloseTo(-96.797, 2);
  });

  it("returns null for an unknown city with no catalog match", () => {
    expect(coordsForDestinationPick("Xyzzyville, Nowhere", "ChIJUnknown")).toBeNull();
  });
});
