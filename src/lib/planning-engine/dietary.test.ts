import { describe, expect, it } from "vitest";
import { dietaryEvidenceFromText, parseDietaryTags } from "@/lib/planning-engine/dietary";

describe("dietaryEvidenceFromText", () => {
  it("accepts clear 'vegan options / available' wording", () => {
    expect(dietaryEvidenceFromText(["Great vegan options for the kids."])).toEqual(["vegan"]);
    expect(dietaryEvidenceFromText(["Several gluten-free dishes on the menu."])).toEqual([
      "gluten-free",
    ]);
    expect(dietaryEvidenceFromText(["Vegan food is available at lunch."])).toEqual(["vegan"]);
  });

  it("treats a dedicated kitchen name as evidence", () => {
    expect(dietaryEvidenceFromText(["Loving Hut Vegan Restaurant"])).toContain("vegan");
  });

  it("ignores hedged, negated, or bare diet words", () => {
    expect(dietaryEvidenceFromText(["The vegan sausage roll was sold out."])).toEqual([]);
    expect(dietaryEvidenceFromText(["No vegan options that we could find."])).toEqual([]);
    expect(dietaryEvidenceFromText(["Limited gluten-free choices, maybe one salad."])).toEqual([]);
    expect(dietaryEvidenceFromText(["They might have vegan food."])).toEqual([]);
  });

  it("still parses restriction tags from free text independently of evidence", () => {
    expect(parseDietaryTags("vegan and gluten-free")).toEqual(["vegan", "gluten-free"]);
  });
});
