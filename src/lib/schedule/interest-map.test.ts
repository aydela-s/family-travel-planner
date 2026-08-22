import { describe, expect, it } from "vitest";
import { interestSourceLabels } from "@/lib/schedule/interest-map";

describe("interestSourceLabels", () => {
  it("maps tags back to selected wizard labels in selection order", () => {
    expect(
      interestSourceLabels(
        ["beaches", "interactive"],
        [
          "Swimming & Water Play",
          "Nature & Scenic Views",
          "Interactive Museums",
          "Shopping",
        ],
      ),
    ).toEqual(["Swimming & Water Play", "Interactive Museums"]);
  });

  it("flags soft-fill parks that were not selected", () => {
    expect(interestSourceLabels(["parks"], ["Shopping", "Interactive Museums"])).toEqual([
      "Parks & Gardens (not in your interests)",
    ]);
  });

  it("normalizes legacy selected labels when mapping tags back", () => {
    expect(interestSourceLabels(["beaches"], ["Beaches & Waterfronts"])).toEqual([
      "Swimming & Water Play",
    ]);
  });
});
