import { describe, expect, it } from "vitest";
import { formatMiles, kmToMiles, milesToKm, roundMiles } from "@/lib/format-distance";

describe("distance display — miles only", () => {
  it("converts kilometers to miles", () => {
    expect(kmToMiles(1.609344)).toBeCloseTo(1, 6);
    expect(kmToMiles(48.5)).toBeCloseTo(30.14, 2);
    expect(milesToKm(kmToMiles(12.3))).toBeCloseTo(12.3, 6);
  });

  it("keeps one decimal under 10 miles and whole miles above", () => {
    expect(roundMiles(1)).toBe(0.6);
    expect(roundMiles(8.4)).toBe(5.2);
    expect(roundMiles(48.5)).toBe(30);
  });

  it("labels every distance in mi, never km", () => {
    expect(formatMiles(8.4)).toBe("5.2 mi");
    expect(formatMiles(0)).toBe("0 mi");
    expect(formatMiles(48.5)).toBe("30 mi");
    expect(formatMiles(12)).not.toMatch(/km/);
  });

  it("never reports a negative distance", () => {
    expect(formatMiles(-5)).toBe("0 mi");
  });
});
