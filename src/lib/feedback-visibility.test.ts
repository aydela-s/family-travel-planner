import { describe, expect, it } from "vitest";
import { shouldAllowFeedbackLauncher } from "@/lib/feedback-visibility";

describe("FAM-79 — feedback launcher visibility", () => {
  it("hides on wizard steps without an itinerary", () => {
    expect(shouldAllowFeedbackLauncher(false)).toBe(false);
  });

  it("shows only when the planner itinerary is present", () => {
    expect(shouldAllowFeedbackLauncher(true)).toBe(true);
  });
});
