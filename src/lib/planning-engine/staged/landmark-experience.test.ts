import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  dayActivityCategories,
  exceedsBudgetStyleTicket,
  isChillDayCompanion,
  isHeavyDayLandmark,
  isThemeParkExperience,
  pairingAllowedForDay,
  sharesDayActivityCategory,
  sharesHeavyDayLoad,
} from "@/lib/planning-engine/staged/landmark-experience";

describe("dayActivityCategories", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("treats waterfront playground + beach as the same day category", () => {
    const waterfront = city.landmarks.find((l) => l.name === "Waterfront Park Playground")!;
    const beach = city.landmarks.find((l) => l.name === "Coronado Beach")!;

    expect(dayActivityCategories(waterfront).has("waterfront")).toBe(true);
    expect(dayActivityCategories(beach).has("beaches")).toBe(true);
    expect(sharesDayActivityCategory(waterfront, beach)).toBe(true);
  });
});

describe("heavy day load", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("treats zoo and Belmont Park as heavy stops that cannot share a day", () => {
    const zoo = city.landmarks.find((l) => l.name === "San Diego Zoo")!;
    const belmont = city.landmarks.find((l) => l.name === "Belmont Park")!;

    expect(isHeavyDayLandmark(zoo)).toBe(true);
    expect(isHeavyDayLandmark(belmont)).toBe(true);
    expect(sharesHeavyDayLoad(zoo, belmont)).toBe(true);
  });
});

describe("theme park chill companions", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("rejects Children's Museum as a Belmont Park day partner", () => {
    const belmont = city.landmarks.find((l) => l.name === "Belmont Park")!;
    const museum = city.landmarks.find((l) => l.name === "The New Children's Museum")!;
    const boardwalk = city.landmarks.find((l) => l.name === "Mission Beach Boardwalk")!;

    expect(isThemeParkExperience(belmont)).toBe(true);
    expect(isChillDayCompanion(museum)).toBe(false);
    expect(pairingAllowedForDay(belmont, museum)).toBe(false);
    expect(isChillDayCompanion(boardwalk)).toBe(true);
    expect(pairingAllowedForDay(belmont, boardwalk)).toBe(true);
  });
});

describe("budgetStyle ticket caps", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("blocks San Diego Zoo on balanced and save budgets", () => {
    const zoo = city.landmarks.find((l) => l.name === "San Diego Zoo")!;
    const fleet = city.landmarks.find((l) => l.name === "Fleet Science Center")!;

    expect(exceedsBudgetStyleTicket(zoo, "balanced")).toBe(true);
    expect(exceedsBudgetStyleTicket(zoo, "save")).toBe(true);
    expect(exceedsBudgetStyleTicket(zoo, "splurge")).toBe(false);
    expect(exceedsBudgetStyleTicket(fleet, "balanced")).toBe(false);
  });
});
