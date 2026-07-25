import { describe, expect, it } from "vitest";
import {
  INTEREST_CATEGORY_DEFAULTS,
  packedLongerDurationForTags,
} from "@/lib/schedule/interest-category-defaults";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { PACKED_LONGER_ACTIVITY_MIN } from "@/lib/schedule/travel-style";

describe("interest category defaults (docs/interest-categories.md)", () => {
  it("maps Nature without Parks & Gardens alias", () => {
    expect(interestTagsFromPlan(["Nature & Scenic Views"])).toEqual(["nature"]);
    expect(interestTagsFromPlan(["Parks & Gardens"])).toEqual(["parks"]);
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
  });
});
