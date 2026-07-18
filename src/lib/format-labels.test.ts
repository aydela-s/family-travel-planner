import { describe, expect, it } from "vitest";
import {
  ACCOMMODATION_LABELS,
  getAccommodationLabel,
  getTransportationLabel,
  TRANSPORTATION_LABELS,
} from "@/lib/format-labels";
import { AccommodationType, TransportationType } from "@/types/trip-plan";

/**
 * Regression coverage for FAM-17 ("Summary page doesn't use same
 * terminology as wizard steps"). Wizard steps and the Summary step both
 * read from these maps, so wording can't literally diverge between them
 * anymore — but nothing stops someone from adding a new enum value without
 * a label, or reverting the locked-in wording. This guards both.
 */

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
];

describe("format-labels — exhaustiveness (FAM-17)", () => {
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
});
