import { describe, expect, it } from "vitest";
import {
  formatPlaceRating,
  formatPlaceRatingBadge,
  formatReviewCountShort,
  formatTimeCompact,
} from "@/lib/format";

describe("formatPlaceRating", () => {
  it("returns empty when rating is missing", () => {
    expect(formatPlaceRating(undefined, 100)).toBe("");
    expect(formatPlaceRating(NaN, 100)).toBe("");
  });

  it("formats rating with review count", () => {
    expect(formatPlaceRating(4.7, 2300)).toBe("Rated 4.7 · 2,300 reviews");
  });

  it("formats rating alone when review count is missing", () => {
    expect(formatPlaceRating(4.5, undefined)).toBe("Rated 4.5");
    expect(formatPlaceRating(5, 0)).toBe("Rated 5.0");
  });
});

describe("formatPlaceRatingBadge", () => {
  it("returns empty when rating is missing", () => {
    expect(formatPlaceRatingBadge(undefined, 100)).toBe("");
  });

  it("formats a compact star badge with short review count", () => {
    expect(formatPlaceRatingBadge(4.5, 3421)).toBe("★4.5 (3.4k)");
    expect(formatPlaceRatingBadge(4.7, 2300)).toBe("★4.7 (2.3k)");
  });

  it("omits review count when missing", () => {
    expect(formatPlaceRatingBadge(4.8, undefined)).toBe("★4.8");
  });
});

describe("formatReviewCountShort", () => {
  it("keeps small counts as-is", () => {
    expect(formatReviewCountShort(426)).toBe("426");
  });

  it("compacts thousands", () => {
    expect(formatReviewCountShort(17936)).toBe("18k");
  });
});

describe("formatTimeCompact", () => {
  it("formats morning and afternoon times", () => {
    expect(formatTimeCompact("08:00")).toBe("8:00a");
    expect(formatTimeCompact("09:15")).toBe("9:15a");
    expect(formatTimeCompact("12:30")).toBe("12:30p");
    expect(formatTimeCompact("18:00")).toBe("6:00p");
  });
});
