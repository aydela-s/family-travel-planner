import { describe, expect, it } from "vitest";
import { restaurantsForCity, restaurantsForCityId } from "./city-restaurants";

describe("restaurantsForCityId", () => {
  it("returns curated San Diego restaurants", () => {
    expect(restaurantsForCityId("san-diego").length).toBeGreaterThan(3);
    expect(restaurantsForCityId("san-diego").some((r) => /Broken Yolk/i.test(r.name))).toBe(true);
  });

  it("does not use NYC default fakes for Places-built cities", () => {
    expect(restaurantsForCityId("places:dallas")).toEqual([]);
    expect(restaurantsForCityId("default")).toEqual([]);
    expect(restaurantsForCityId("places:dallas").some((r) => /River Noodle|Green Bowl/i.test(r.name))).toBe(
      false,
    );
  });

  it("uses a Places-attached restaurant pool for non-curated cities", () => {
    const pool = [
      {
        name: "Pecan Lodge",
        lat: 32.78,
        lng: -96.8,
        meals: ["lunch", "dinner"] as const,
        ageTags: ["child", "tween", "teen"] as const,
        dietary: [],
        budgetStyles: ["balanced"] as const,
        familyNote: "Nearby restaurant from Google Places.",
      },
    ];
    expect(restaurantsForCity({ id: "places:dallas", restaurants: [...pool] })).toEqual(pool);
    expect(restaurantsForCity({ id: "places:dallas" })).toEqual([]);
  });
});
