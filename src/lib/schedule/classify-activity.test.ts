import { describe, expect, it } from "vitest";
import { inferInterestTagsFromName } from "@/lib/schedule/classify-activity";

describe("inferInterestTagsFromName (docs/interest-categories.md)", () => {
  it("classifies planetariums as interactive museums", () => {
    expect(inferInterestTagsFromName("Griffith Observatory Planetarium")).toEqual(["interactive"]);
  });

  it("classifies escape rooms and arcades as sports", () => {
    expect(inferInterestTagsFromName("Downtown Escape Room")).toEqual(["sports"]);
    expect(inferInterestTagsFromName("Family Fun Arcade")).toEqual(["sports"]);
  });

  it("classifies pools and hybrid water parks as swimming, not sports or theme parks", () => {
    expect(inferInterestTagsFromName("Community Swimming Pool")).toEqual(["beaches"]);
    expect(inferInterestTagsFromName("Hawaiian Falls Water Park")).toEqual(["beaches"]);
  });

  it("keeps ride-focused theme parks on theme-parks", () => {
    expect(inferInterestTagsFromName("Six Flags Fiesta Texas")).toEqual(["theme-parks"]);
    expect(inferInterestTagsFromName("Legoland California")).toEqual(["theme-parks"]);
  });

  it("splits observe-first zoos from interactive animal experiences", () => {
    expect(inferInterestTagsFromName("San Diego Zoo")).toEqual(["zoos"]);
    expect(inferInterestTagsFromName("SEA LIFE Aquarium")).toEqual(["zoos"]);
    expect(inferInterestTagsFromName("County Petting Zoo")).toEqual(["animal-experiences"]);
    expect(inferInterestTagsFromName("Wildlife Sanctuary")).toEqual(["animal-experiences"]);
    expect(inferInterestTagsFromName("Hill Country Horseback Riding")).toEqual(["animal-experiences"]);
  });

  it("classifies children's museums as interactive, not look-don't-touch museums", () => {
    expect(inferInterestTagsFromName("Children's Museum of Denver")).toEqual(["interactive"]);
    expect(inferInterestTagsFromName("Denver Art Museum")).toEqual(["museums"]);
  });

  it("classifies historic house museums as museums and guided tours as tours", () => {
    expect(inferInterestTagsFromName("Heritage House Museum")).toEqual(["museums"]);
    expect(inferInterestTagsFromName("Old Town Trolley Tour")).toEqual(["tours"]);
    expect(inferInterestTagsFromName("City Hop-On Hop-Off Bus")).toEqual(["tours"]);
    expect(inferInterestTagsFromName("Edinburgh Castle")).toEqual(["history"]);
  });

  it("classifies fairs as entertainment and family entertainment centers as sports", () => {
    expect(inferInterestTagsFromName("State Fair of Texas")).toEqual(["entertainment"]);
    expect(inferInterestTagsFromName("Family Entertainment Center")).toEqual(["sports"]);
  });
});
