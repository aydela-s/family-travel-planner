import { describe, expect, it } from "vitest";
import { emptyPlanningRules } from "@/lib/planning-engine/staged/blueprint";
import {
  isBeachThemeAnchor,
  isFamilyWaterPlayExperience,
} from "@/lib/planning-engine/staged/landmark-experience";
import { hasBlockedPlaceName } from "@/lib/maps/family-friendly-places";
import { isDestinationShoppingPlace } from "@/lib/maps/shopping-places";
import { INTEREST_LABEL_TO_TAGS } from "@/lib/schedule/interest-map";
import {
  getIntensityConfig,
  prefersSingleActivityDays,
} from "@/lib/schedule/travel-style";
import type { Landmark } from "@/config/city-pricing";
import type { TripPlan } from "@/types/trip-plan";

/**
 * Ground-truth profile from a real Dallas family trip (2 weeks, sister's house,
 * kids 3 & 6, nap 12:30–2 at home, taxis, mostly cook-at-home).
 * Pace for that trip maps to travelStyle "relaxed" (one meaningful outing / day);
 * the default fixture below stays "balanced" for other interest/POI checks.
 *
 * Activities that worked: Heights Family Aquatic Center, indoor water park,
 * Perot Museum, Bubble Planet, Grapevine Mills, We Rock the Spectrum,
 * Dallas JCC swim, Takeoff Adventure Park.
 * Miss: Reunion Tower (too far, not interesting for young kids).
 */
function dallasReferencePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Dallas, TX, USA",
    startDate: "2026-08-17",
    endDate: "2026-08-30",
    adults: 1,
    children: [3, 6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "rental_with_kitchen",
    dietaryRestrictions: "",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [
      "Interactive Museums",
      "Playgrounds & Indoor Play",
      "Shopping",
      "Swimming & Water Play",
    ],
    ...overrides,
  };
}

function landmark(partial: Partial<Landmark> & Pick<Landmark, "name" | "interestTags">): Landmark {
  return {
    lat: 32.78,
    lng: -96.8,
    adultPrice: 20,
    openingHours: { open: "09:00", close: "18:00" },
    intensity: "medium",
    ageTags: ["toddler", "child"],
    indoor: false,
    ...partial,
  };
}

describe("Dallas family reference — pace", () => {
  it("uses one activity per day for relaxed + young kids (Dallas-style outing)", () => {
    const plan = dallasReferencePlan({ travelStyle: "relaxed" });
    expect(prefersSingleActivityDays(plan)).toBe(true);
    expect(getIntensityConfig(plan).maxActivities).toBe(1);
    expect(emptyPlanningRules(plan).capacity.maxActivitiesPerDay).toBe(1);
    expect(emptyPlanningRules(plan).capacity.maxSupportStops).toBe(0);
  });

  it("gives balanced + young kids two activity slots (not collapsed by nap)", () => {
    const plan = dallasReferencePlan({ travelStyle: "balanced" });
    expect(prefersSingleActivityDays(plan)).toBe(false);
    expect(getIntensityConfig(plan).maxActivities).toBe(2);
    expect(emptyPlanningRules(plan).capacity.maxActivitiesPerDay).toBe(2);
    expect(emptyPlanningRules(plan).capacity.maxSupportStops).toBe(1);
    // Nap softens load budget vs no-nap, but does not drop to a single slot.
    const withNap = getIntensityConfig(plan).maxLoadUnits;
    const noNap = getIntensityConfig(dallasReferencePlan({ naps: [] })).maxLoadUnits;
    expect(withNap).toBeLessThan(noNap);
  });

  it("still allows packed days to schedule more than balanced", () => {
    const balanced = dallasReferencePlan({ travelStyle: "balanced" });
    const packed = dallasReferencePlan({ travelStyle: "packed" });
    expect(getIntensityConfig(packed).maxActivities).toBeGreaterThan(
      getIntensityConfig(balanced).maxActivities,
    );
  });
});

describe("Dallas family reference — interests & POI quality", () => {
  it("maps Swimming & Water Play to beaches coverage", () => {
    expect(INTEREST_LABEL_TO_TAGS["Swimming & Water Play"]).toEqual(["beaches"]);
  });

  it("treats aquatic centers and indoor water parks as water-day anchors", () => {
    expect(
      isFamilyWaterPlayExperience(
        landmark({ name: "Heights Family Aquatic Center", interestTags: ["beaches"] }),
      ),
    ).toBe(true);
    expect(
      isBeachThemeAnchor(
        landmark({ name: "Epic Waters Indoor Waterpark", interestTags: ["beaches", "theme-parks"] }),
      ),
    ).toBe(true);
    expect(
      isBeachThemeAnchor(
        landmark({ name: "Dallas JCC", interestTags: ["sports", "beaches"] }),
      ),
    ).toBe(true);
  });

  it("accepts Grapevine Mills as destination shopping", () => {
    expect(
      isDestinationShoppingPlace({
        name: "Grapevine Mills",
        types: ["shopping_mall"],
        websiteUri: "https://www.simon.com/mall/grapevine-mills",
      }),
    ).toBe(true);
  });

  it("blocks Reunion Tower–style observation decks from the family pool", () => {
    expect(hasBlockedPlaceName("Reunion Tower")).toBe(true);
    expect(hasBlockedPlaceName("Observation Deck")).toBe(true);
    expect(hasBlockedPlaceName("Perot Museum of Nature and Science")).toBe(false);
  });
});
