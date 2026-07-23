import { describe, expect, it } from "vitest";
import { alignTitleWithTimeOfDay, formatTripDateRange, oneLineNote } from "@/lib/format";

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

  it("keeps Nap & Quiet Time intact when afternoon stripping runs", () => {
    expect(alignTitleWithTimeOfDay("Nap & Quiet Time", "afternoon")).toBe("Nap & Quiet Time");
    expect(alignTitleWithTimeOfDay("Nap & Quiet Time", "morning")).toBe("Nap & Quiet Time");
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
