import { describe, expect, it } from "vitest";
import { alignTitleWithTimeOfDay, formatTripDateRange } from "@/lib/format";

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
});
