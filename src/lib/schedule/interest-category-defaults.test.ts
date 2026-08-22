import { describe, expect, it } from "vitest";
import {
  INTEREST_CATEGORY_DEFAULTS,
  packedLongerDurationForTags,
} from "@/lib/schedule/interest-category-defaults";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { PACKED_LONGER_ACTIVITY_MIN } from "@/lib/schedule/travel-style";

describe("interest category defaults (docs/interest-categories.md)", () => {
  it("uses canonical category ids from the taxonomy doc", () => {
    expect(INTEREST_CATEGORY_DEFAULTS.beaches.id).toBe("swimming_water_play");
    expect(INTEREST_CATEGORY_DEFAULTS.playgrounds.id).toBe("indoor_outdoor_play");
    expect(INTEREST_CATEGORY_DEFAULTS["indoor-play"].id).toBe("indoor_outdoor_play");
    expect(INTEREST_CATEGORY_DEFAULTS["animal-experiences"].id).toBe("animal_experiences");
    expect(INTEREST_CATEGORY_DEFAULTS.tours.id).toBe("tours_sightseeing");
  });

  it("maps Nature without Parks & Gardens alias", () => {
    expect(interestTagsFromPlan(["Nature & Scenic Views"])).toEqual(["nature"]);
    expect(interestTagsFromPlan(["Parks & Gardens"])).toEqual(["parks"]);
  });

  it("maps Animal Experiences and Tours & Sightseeing to distinct catalog tags", () => {
    expect(interestTagsFromPlan(["Animal Experiences"])).toEqual(["animal-experiences"]);
    expect(interestTagsFromPlan(["Tours & Sightseeing"])).toEqual(["tours"]);
    expect(interestTagsFromPlan(["Zoos & Aquariums"])).toEqual(["zoos"]);
    expect(interestTagsFromPlan(["History & Landmarks"])).toEqual(["history"]);
  });

  it("uses category duration maxima for packed longer adventures", () => {
    expect(packedLongerDurationForTags(undefined)).toBe(PACKED_LONGER_ACTIVITY_MIN);
    expect(packedLongerDurationForTags([])).toBe(PACKED_LONGER_ACTIVITY_MIN);
    expect(packedLongerDurationForTags(["playgrounds"])).toBe(
      INTEREST_CATEGORY_DEFAULTS.playgrounds.durationMax,
    );
    expect(packedLongerDurationForTags(["parks"])).toBe(
      INTEREST_CATEGORY_DEFAULTS.parks.durationMax,
    );
    // Longer categories stretch to the packed adventure floor on multi-stop days.
    expect(packedLongerDurationForTags(["nature"])).toBe(PACKED_LONGER_ACTIVITY_MIN);
    expect(packedLongerDurationForTags(["beaches"])).toBe(PACKED_LONGER_ACTIVITY_MIN);
    expect(packedLongerDurationForTags(["theme-parks"])).toBe(
      INTEREST_CATEGORY_DEFAULTS["theme-parks"].durationMin,
    );
    expect(packedLongerDurationForTags(["indoor-play"])).toBe(
      INTEREST_CATEGORY_DEFAULTS["indoor-play"].durationMax,
    );
    expect(INTEREST_CATEGORY_DEFAULTS["indoor-play"].durationMin).toBe(90);
    expect(INTEREST_CATEGORY_DEFAULTS.shopping.durationMin).toBe(90);
    expect(INTEREST_CATEGORY_DEFAULTS.shopping.durationMax).toBe(180);
    expect(INTEREST_CATEGORY_DEFAULTS.beaches.durationMin).toBe(120);
    expect(INTEREST_CATEGORY_DEFAULTS.beaches.durationMax).toBe(180);
  });
});
