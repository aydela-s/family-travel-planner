import { describe, expect, it } from "vitest";
import { emailAssetOrigin, emailLogoUrl, feedbackPath } from "@/lib/public-urls";

describe("public-urls — email assets & paths", () => {
  it("uses a non-localhost host for the email logo", () => {
    expect(emailAssetOrigin("http://localhost:3000")).not.toMatch(/localhost/);
    expect(emailLogoUrl("http://localhost:3000")).toMatch(
      /^https:\/\/.+\/tripnestly-logo\.png$/,
    );
  });

  it("points feedback at the dedicated page", () => {
    expect(feedbackPath()).toBe("/feedback");
  });
});
