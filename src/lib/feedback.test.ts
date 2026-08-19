import { describe, expect, it } from "vitest";
import {
  FEEDBACK_MESSAGE_MIN,
  buildFeedbackEmail,
  validateFeedbackPayload,
} from "@/lib/feedback";

describe("feedback validation — FAM-49", () => {
  it("rejects short messages", () => {
    const result = validateFeedbackPayload({ message: "too short" });
    expect(result.ok).toBe(false);
  });

  it("accepts a message at the minimum length", () => {
    const message = "x".repeat(FEEDBACK_MESSAGE_MIN);
    const result = validateFeedbackPayload({ message });
    expect(result).toEqual({ ok: true, message, email: undefined, pageUrl: undefined });
  });

  it("rejects invalid optional emails", () => {
    const result = validateFeedbackPayload({
      message: "This itinerary skipped lunch somehow.",
      email: "not-an-email",
    });
    expect(result.ok).toBe(false);
  });

  it("keeps a valid reply-to email", () => {
    const result = validateFeedbackPayload({
      message: "This itinerary skipped lunch somehow.",
      email: " parent@example.com ",
      pageUrl: "http://localhost:3000/plan",
    });
    expect(result).toEqual({
      ok: true,
      message: "This itinerary skipped lunch somehow.",
      email: "parent@example.com",
      pageUrl: "http://localhost:3000/plan",
    });
  });

  it("builds a plain-text email body with context", () => {
    const email = buildFeedbackEmail({
      brandName: "FamilyTravely",
      message: "Map was blank on day 2.",
      email: "a@b.co",
      pageUrl: "http://localhost:3000/plan",
    });
    expect(email.subject).toBe("[FamilyTravely feedback]");
    expect(email.text).toContain("Map was blank on day 2.");
    expect(email.text).toContain("Reply-to: a@b.co");
    expect(email.text).toContain("http://localhost:3000/plan");
  });
});
