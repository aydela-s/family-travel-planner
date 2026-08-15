import { describe, expect, it } from "vitest";
import {
  BLOCKED_PLACE_TYPES,
  familyPlaceScore,
  hasBlockedPlaceName,
  hasBlockedPlaceType,
  isBlockedFamilyPlace,
  isRestaurantSearchCategory,
  placeKindForCategory,
  preferredTypeBoost,
} from "@/lib/maps/family-friendly-places";

describe("family-friendly Places filter (FAM-60)", () => {
  it("blocks nightlife and casino types", () => {
    expect(hasBlockedPlaceType(["night_club"])).toBe(true);
    expect(hasBlockedPlaceType(["casino", "tourist_attraction"])).toBe(true);
    expect(hasBlockedPlaceType(["bar"])).toBe(true);
    expect(hasBlockedPlaceType(["liquor_store"])).toBe(true);
    expect(hasBlockedPlaceType(["park", "tourist_attraction"])).toBe(false);
    for (const t of ["night_club", "casino", "bar", "liquor_store"]) {
      expect(BLOCKED_PLACE_TYPES.has(t)).toBe(true);
    }
  });

  it("blocks unsuitable names when types are missing", () => {
    expect(hasBlockedPlaceName("Dallas Nightclub")).toBe(true);
    expect(hasBlockedPlaceName("Lucky Casino Downtown")).toBe(true);
    expect(hasBlockedPlaceName("Gentlemen's Club")).toBe(true);
    expect(hasBlockedPlaceName("Hookah Lounge")).toBe(true);
    expect(hasBlockedPlaceName("Dallas Zoo")).toBe(false);
    expect(hasBlockedPlaceName("Perot Museum")).toBe(false);
    expect(hasBlockedPlaceName("Reunion Tower")).toBe(true);
    expect(hasBlockedPlaceName("Sky Deck Observation")).toBe(true);
  });

  it("isBlockedFamilyPlace combines type and name rules", () => {
    expect(
      isBlockedFamilyPlace({
        name: "Famous Zoo",
        types: ["zoo", "tourist_attraction"],
      }),
    ).toBe(false);
    expect(
      isBlockedFamilyPlace({
        name: "Neon Bar",
        primaryType: "bar",
      }),
    ).toBe(true);
    expect(
      isBlockedFamilyPlace({
        name: "VIP Strip Club",
        types: ["tourist_attraction"],
      }),
    ).toBe(true);
  });

  it("detects restaurant search categories", () => {
    expect(isRestaurantSearchCategory("family restaurants")).toBe(true);
    expect(placeKindForCategory("family restaurants")).toBe("restaurant");
    expect(placeKindForCategory("Zoos & Aquariums")).toBe("attraction");
  });

  it("boosts preferred family types deterministically", () => {
    const zooBoost = preferredTypeBoost(["zoo"], null, "attraction");
    const parkBoost = preferredTypeBoost(["park"], null, "attraction");
    const genericBoost = preferredTypeBoost(["point_of_interest"], null, "attraction");
    expect(zooBoost).toBeGreaterThan(parkBoost);
    expect(parkBoost).toBeGreaterThan(genericBoost);
    expect(genericBoost).toBe(0);

    const restaurantBoost = preferredTypeBoost(["restaurant"], null, "restaurant");
    expect(restaurantBoost).toBeGreaterThan(0);
  });

  it("ranks preferred types above equal rating/reviews without them", () => {
    const zoo = familyPlaceScore({
      rating: 4.6,
      reviewCount: 1000,
      types: ["zoo"],
      kind: "attraction",
    });
    const generic = familyPlaceScore({
      rating: 4.6,
      reviewCount: 1000,
      types: ["point_of_interest"],
      kind: "attraction",
    });
    expect(zoo).toBeGreaterThan(generic);
    // Stable for identical input
    expect(
      familyPlaceScore({
        rating: 4.6,
        reviewCount: 1000,
        types: ["zoo"],
        kind: "attraction",
      }),
    ).toBe(zoo);
  });
});
