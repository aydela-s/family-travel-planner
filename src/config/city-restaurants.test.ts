import { describe, expect, it } from "vitest";
import { restaurantsForCityId } from "./city-restaurants";

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
});
