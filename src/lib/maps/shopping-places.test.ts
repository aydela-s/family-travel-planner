import { describe, expect, it } from "vitest";
import {
  hasShoppingWebsite,
  isDestinationShoppingPlace,
  isShoppingSearchCategory,
  looksLikeWeakShoppingName,
  shoppingPlaceScoreBoost,
} from "@/lib/maps/shopping-places";

describe("shopping place quality", () => {
  it("detects shopping search categories", () => {
    expect(isShoppingSearchCategory("Shopping")).toBe(true);
    expect(
      isShoppingSearchCategory("shopping mall outlet center shopping district"),
    ).toBe(true);
    expect(isShoppingSearchCategory("museums")).toBe(false);
  });

  it("rejects missing website as a red flag", () => {
    expect(hasShoppingWebsite(null)).toBe(false);
    expect(hasShoppingWebsite("")).toBe(false);
    expect(hasShoppingWebsite("https://northparkcenter.com")).toBe(true);
    expect(
      isDestinationShoppingPlace({
        name: "The Hill",
        types: ["shopping_mall"],
        websiteUri: null,
      }),
    ).toBe(false);
  });

  it("rejects weak strip / 'Shops at' centers even with a website", () => {
    expect(looksLikeWeakShoppingName("The Shops at Park Lane")).toBe(true);
    expect(
      isDestinationShoppingPlace({
        name: "The Shops at Park Lane",
        types: ["shopping_mall"],
        websiteUri: "https://example.com",
      }),
    ).toBe(false);
    expect(
      isDestinationShoppingPlace({
        name: "Lincoln Park",
        types: ["point_of_interest"],
        websiteUri: "https://example.com",
      }),
    ).toBe(false);
  });

  it("keeps destination malls and outlets with a website", () => {
    expect(
      isDestinationShoppingPlace({
        name: "NorthPark Center",
        types: ["shopping_mall"],
        primaryType: "shopping_mall",
        websiteUri: "https://northparkcenter.com",
      }),
    ).toBe(true);
    expect(
      isDestinationShoppingPlace({
        name: "Dallas Premium Outlets",
        types: ["shopping_mall"],
        websiteUri: "https://premiumoutlets.com/outlet/dallas",
      }),
    ).toBe(true);
    expect(
      isDestinationShoppingPlace({
        name: "Grapevine Mills",
        types: ["shopping_mall"],
        websiteUri: "https://www.simon.com/mall/grapevine-mills",
      }),
    ).toBe(true);
    expect(
      shoppingPlaceScoreBoost({
        name: "Dallas Premium Outlets",
        types: ["shopping_mall"],
        websiteUri: "https://premiumoutlets.com/outlet/dallas",
      }),
    ).toBeGreaterThan(
      shoppingPlaceScoreBoost({
        name: "NorthPark Center",
        types: ["shopping_mall"],
        websiteUri: "https://northparkcenter.com",
      }),
    );
  });
});
