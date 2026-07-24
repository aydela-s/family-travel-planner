import { describe, expect, it } from "vitest";
import {
  getLocalPlaceSuggestions,
  mergePlaceSuggestions,
  shouldLogGooglePlacesFailure,
} from "@/lib/places-autocomplete";

/**
 * Regression coverage for FAM-11 ("multiple suggestions of the same place
 * when typing a few letters"). Aliases must match queries but must not each
 * become a separate dropdown row.
 */

describe("getLocalPlaceSuggestions — FAM-11", () => {
  it("returns a single Paris suggestion for query 'paris'", () => {
    const suggestions = getLocalPlaceSuggestions("paris");
    const paris = suggestions.filter((s) => s.placeId === "paris");

    expect(paris).toHaveLength(1);
    expect(paris[0]?.label).toBe("Paris, France");
  });

  it("matches via alias but still emits only the canonical label", () => {
    expect(getLocalPlaceSuggestions("paris france")).toEqual([
      { label: "Paris, France", placeId: "paris" },
    ]);
  });

  it("does not emit title-cased alias strings as separate suggestions", () => {
    const labels = getLocalPlaceSuggestions("paris").map((s) => s.label);

    expect(labels).not.toContain("Paris");
    expect(labels).not.toContain("Paris France");
  });

  it("uses full country names except well-known abbreviations", () => {
    expect(getLocalPlaceSuggestions("san diego")[0]?.label).toBe("San Diego, USA");
    expect(getLocalPlaceSuggestions("london")[0]?.label).toBe("London, UK");
    expect(getLocalPlaceSuggestions("tokyo")[0]?.label).toBe("Tokyo, Japan");
    expect(getLocalPlaceSuggestions("tel aviv")[0]?.label).toBe("Tel Aviv, Israel");
  });
});

describe("getLocalPlaceSuggestions — FAM-16 popular cities", () => {
  it("suggests Dallas even without Google Places", () => {
    const suggestions = getLocalPlaceSuggestions("dallas");
    expect(suggestions.some((s) => /dallas/i.test(s.label))).toBe(true);
    expect(suggestions[0]?.label).toBe("Dallas, USA");
  });

  it("suggests New York via nyc alias", () => {
    const suggestions = getLocalPlaceSuggestions("nyc");
    expect(suggestions.some((s) => /new york/i.test(s.label))).toBe(true);
  });

  it("suggests Orlando from the popular catalog", () => {
    expect(getLocalPlaceSuggestions("orlando")[0]?.label).toMatch(/orlando/i);
  });
});

describe("mergePlaceSuggestions — FAM-16", () => {
  it("keeps Google results and fills gaps from local", () => {
    const merged = mergePlaceSuggestions(
      [{ label: "Austin, TX, USA", placeId: "google-austin" }],
      [
        { label: "Austin, USA", placeId: "austin" },
        { label: "Dallas, USA", placeId: "dallas" },
      ],
    );

    expect(merged.map((s) => s.placeId)).toEqual(["google-austin", "dallas"]);
  });

  it("returns local-only when Google is empty (Dallas repro)", () => {
    const local = getLocalPlaceSuggestions("dallas");
    const merged = mergePlaceSuggestions([], local);
    expect(merged.some((s) => /dallas/i.test(s.label))).toBe(true);
  });

  it("does not duplicate the same city from Google and local", () => {
    const merged = mergePlaceSuggestions(
      [{ label: "Paris, France", placeId: "ChIJparis" }],
      [{ label: "Paris, France", placeId: "paris" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.placeId).toBe("ChIJparis");
  });
});

describe("Google Places status helpers — FAM-16", () => {
  it("logs denied and quota failures but not OK/ZERO_RESULTS", () => {
    expect(shouldLogGooglePlacesFailure("REQUEST_DENIED")).toBe(true);
    expect(shouldLogGooglePlacesFailure("OVER_QUERY_LIMIT")).toBe(true);
    expect(shouldLogGooglePlacesFailure("OK")).toBe(false);
    expect(shouldLogGooglePlacesFailure("ZERO_RESULTS")).toBe(false);
  });
});
