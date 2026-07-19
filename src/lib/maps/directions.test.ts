import { describe, expect, it } from "vitest";
import { formatTransportDisplay } from "@/lib/maps/directions";

describe("formatTransportDisplay — FAM-38", () => {
  it("appends cost with a colon, without a Transport suffix", () => {
    expect(
      formatTransportDisplay(
        "public-transportation",
        "Public transit day pass × 4",
        32,
        "$",
      ),
    ).toBe("Public transit day pass × 4: $32.00");
  });

  it("uses Included / walking when transport cost is zero", () => {
    expect(
      formatTransportDisplay("walking", "8,500 steps · 6.2 km walking", 0, "$"),
    ).toBe("8,500 steps · 6.2 km walking: Included / walking");
  });
});
