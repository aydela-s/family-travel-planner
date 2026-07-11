import { describe, expect, it } from "vitest";
import { getLocalPlaceSuggestions } from "@/lib/places-autocomplete";

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
    expect(getLocalPlaceSuggestions("san diego")[0]?.label).toBe(
      "San Diego, USA",
    );
    expect(getLocalPlaceSuggestions("london")[0]?.label).toBe("London, UK");
    expect(getLocalPlaceSuggestions("tokyo")[0]?.label).toBe("Tokyo, Japan");
    expect(getLocalPlaceSuggestions("tel aviv")[0]?.label).toBe(
      "Tel Aviv, Israel",
    );
  });
});
