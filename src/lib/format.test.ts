import { describe, expect, it } from "vitest";
import {
  alignTitleWithTimeOfDay,
  formatAdultsLabel,
  formatKidsWithAges,
  formatTimeShort,
  formatTripDateRange,
  oneLineNote,
  shouldShowLineItemCost,
} from "@/lib/format";
import type { ItineraryActivity } from "@/types/itinerary";

describe("formatTimeShort", () => {
  it("uses 9a / 4p / 10:15a style times", () => {
    expect(formatTimeShort("09:00")).toBe("9a");
    expect(formatTimeShort("16:00")).toBe("4p");
    expect(formatTimeShort("10:15")).toBe("10:15a");
  });
});

describe("formatTripDateRange — FAM-37", () => {
  it("formats an inclusive start–end range", () => {
    expect(formatTripDateRange("2026-07-14", "2026-07-17")).toBe(
      "July 14, 2026 – July 17, 2026",
    );
  });

  it("collapses to a single date when start and end match", () => {
    expect(formatTripDateRange("2026-07-14", "2026-07-14")).toBe("July 14, 2026");
  });
});

describe("alignTitleWithTimeOfDay — FAM-18", () => {
  it("does not add Morning: or Afternoon: prefixes", () => {
    expect(alignTitleWithTimeOfDay("Explore Louvre Museum", "morning")).toBe(
      "Explore Louvre Museum",
    );
    expect(alignTitleWithTimeOfDay("Explore Louvre Museum", "afternoon")).toBe(
      "Explore Louvre Museum",
    );
  });

  it("strips legacy Morning:/Afternoon: prefixes if present", () => {
    expect(alignTitleWithTimeOfDay("Morning: Explore Louvre Museum", "morning")).toBe(
      "Explore Louvre Museum",
    );
    expect(alignTitleWithTimeOfDay("Afternoon: Visit Eiffel Tower", "afternoon")).toBe(
      "Visit Eiffel Tower",
    );
  });

  it("keeps Nap intact when afternoon stripping runs", () => {
    expect(alignTitleWithTimeOfDay("Nap", "afternoon")).toBe("Nap");
    expect(alignTitleWithTimeOfDay("Nap", "morning")).toBe("Nap");
  });

  it("renames Evening stroll to Afternoon stroll when the slot is afternoon", () => {
    expect(alignTitleWithTimeOfDay("Evening stroll near Louvre", "afternoon")).toBe(
      "Afternoon stroll near Louvre",
    );
  });
});

describe("oneLineNote", () => {
  it("keeps only the first sentence", () => {
    expect(oneLineNote("Easy pace before dinner. Extra detail here.")).toBe(
      "Easy pace before dinner.",
    );
  });
});

describe("shouldShowLineItemCost — FAM-84 rule 17", () => {
  it("shows cost only when activityCost is positive and not transport-covered", () => {
    const free: Pick<ItineraryActivity, "activityCost" | "transportCovered"> = {
      activityCost: 0,
    };
    const paid: Pick<ItineraryActivity, "activityCost" | "transportCovered"> = {
      activityCost: 42,
    };
    const covered: Pick<ItineraryActivity, "activityCost" | "transportCovered"> = {
      activityCost: 15,
      transportCovered: true,
    };
    expect(shouldShowLineItemCost(free)).toBe(false);
    expect(shouldShowLineItemCost(paid)).toBe(true);
    expect(shouldShowLineItemCost(covered)).toBe(false);
  });
});

describe("formatKidsWithAges", () => {
  it("includes kids ages in parentheses", () => {
    expect(formatKidsWithAges([4, 8])).toBe("2 kids (ages 4, 8)");
    expect(formatKidsWithAges([2])).toBe("1 kid (age 2)");
  });

  it("returns empty when there are no kids", () => {
    expect(formatKidsWithAges([])).toBe("");
  });
});

describe("formatAdultsLabel", () => {
  it("pluralizes adults", () => {
    expect(formatAdultsLabel(1)).toBe("1 adult");
    expect(formatAdultsLabel(2)).toBe("2 adults");
  });
});
