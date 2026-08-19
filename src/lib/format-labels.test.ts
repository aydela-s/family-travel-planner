import { describe, expect, it } from "vitest";
import {
  ACCOMMODATION_LABELS,
  BUDGET_STYLE_LABELS,
  getAccommodationLabel,
  getBudgetStyleLabelPlain,
  getTransportationLabel,
  getTravelStyleLabel,
  TRANSPORTATION_LABELS,
  TRAVEL_STYLE_LABELS,
} from "@/lib/format-labels";
import {
  AccommodationType,
  BudgetStyle,
  TransportationType,
  TravelStyle,
} from "@/types/trip-plan";

/**
 * Regression coverage for FAM-17 (wizard and display labels stay aligned).
 */

const ALL_TRAVEL_STYLES: TravelStyle[] = ["relaxed", "balanced", "packed"];
const ALL_BUDGET_STYLES: BudgetStyle[] = ["save", "balanced", "splurge"];

const ALL_TRANSPORTATION_TYPES: TransportationType[] = [
  "walking",
  "car-rental",
  "taxis",
  "public-transportation",
];

const ALL_ACCOMMODATION_TYPES: AccommodationType[] = [
  "hotel_breakfast_included",
  "hotel_no_breakfast",
  "airbnb_with_kitchen",
  "airbnb_no_kitchen",
  "staying_with_family_or_friends",
  "dont_know_yet",
];

describe("format-labels — exhaustiveness (FAM-17)", () => {
  it.each(ALL_TRAVEL_STYLES)(
    "every TravelStyle has a non-empty label — %s",
    (style) => {
      expect(TRAVEL_STYLE_LABELS[style]).toBeTruthy();
      expect(getTravelStyleLabel(style)).toBe(TRAVEL_STYLE_LABELS[style]);
    },
  );

  it.each(ALL_BUDGET_STYLES)(
    "every BudgetStyle has a non-empty label — %s",
    (style) => {
      expect(BUDGET_STYLE_LABELS[style].label).toBeTruthy();
      expect(getBudgetStyleLabelPlain(style)).toBe(BUDGET_STYLE_LABELS[style].label);
    },
  );

  it.each(ALL_TRANSPORTATION_TYPES)(
    "every TransportationType has a non-empty label — %s",
    (type) => {
      expect(TRANSPORTATION_LABELS[type]).toBeTruthy();
      expect(getTransportationLabel(type)).toBe(TRANSPORTATION_LABELS[type]);
    },
  );

  it.each(ALL_ACCOMMODATION_TYPES)(
    "every AccommodationType has a non-empty label — %s",
    (type) => {
      expect(ACCOMMODATION_LABELS[type]).toBeTruthy();
      expect(getAccommodationLabel(type)).toBe(ACCOMMODATION_LABELS[type]);
    },
  );

  it("unset transportation type falls back to an em dash, not a raw enum value", () => {
    expect(getTransportationLabel("")).toBe("—");
  });

  it("unset accommodation type falls back to a readable placeholder", () => {
    expect(getAccommodationLabel("")).toBe("Not specified");
  });
});

describe("format-labels — locked wording (FAM-17)", () => {
  it("taxis is singular 'Taxi', not 'Taxis & rideshares'", () => {
    expect(TRANSPORTATION_LABELS.taxis).toBe("Taxi");
  });

  it("locks in the exact wizard-step wording for the remaining transportation options", () => {
    expect(TRANSPORTATION_LABELS.walking).toBe("Walking");
    expect(TRANSPORTATION_LABELS["car-rental"]).toBe("Car");
    expect(TRANSPORTATION_LABELS["public-transportation"]).toBe("Public transit");
  });

  it("accommodation labels never introduce the word 'Airbnb', matching the wizard step wording", () => {
    for (const type of ALL_ACCOMMODATION_TYPES) {
      expect(ACCOMMODATION_LABELS[type].toLowerCase()).not.toContain("airbnb");
    }
  });

  it("budget mid tier is Comfortable, not Balanced (pace already uses Balanced)", () => {
    expect(BUDGET_STYLE_LABELS.balanced.label).toBe("Comfortable");
    expect(TRAVEL_STYLE_LABELS.balanced).toBe("Balanced");
  });
});
