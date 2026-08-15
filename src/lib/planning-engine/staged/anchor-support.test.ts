import { describe, expect, it } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { planTrip } from "@/lib/planning-engine";
import {
  applyDailyThemes,
  buildTripStrategy,
  commitStopsToBlueprint,
  isIndoorPlayExperience,
  isOutdoorPlayground,
  isShorelineBeachExperience,
  LOW_FRICTION_STAY_KM,
  selectAnchorForDay,
} from "@/lib/planning-engine/staged";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import {
  exceedsBudgetStyleTicket,
  isHeavyDayLandmark,
  pairingAllowedForDay,
  sharesDayActivityCategory,
} from "@/lib/planning-engine/staged/landmark-experience";
import { activityTitlesByDay } from "@/lib/planning-engine/staged/fingerprint";
import { haversineKm } from "@/lib/maps/directions";
import { TripPlan } from "@/types/trip-plan";

function sdPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    stayAddress: "Carlton",
    stayLat: 32.7157,
    stayLng: -117.1611,
    dietaryRestrictions: "vegan",
    naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
    budgetStyle: "balanced",
    interests: [
      "Playgrounds & Indoor Play",
      "Interactive Museums",
      "Beaches & Waterfronts",
      "Shows & Entertainment",
    ],
    ...overrides,
  };
}

describe("selectAnchorForDay", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  function beachDayBlueprint(plan: TripPlan) {
    const base = buildTripStrategy(plan, { city }).days[1]!;
    return {
      ...base,
      role: "full" as const,
      theme: {
        id: "beach" as const,
        label: "Beach",
        primaryTags: ["beaches" as const],
        secondaryTags: ["nature" as const],
        preferredExperienceTypes: ["beaches" as const, "nature" as const, "sports" as const],
      },
      goals: [{ type: "dedicated_experience" as const, tag: "beaches" as const }],
      constraints: [
        {
          type: "anchor_primary_tags" as const,
          tags: ["beaches" as const],
          mode: "any" as const,
        },
        { type: "prefer_shoreline_beach_anchor" as const },
        { type: "discourage_indoor_paid_anchor" as const },
        { type: "prefer_free_anchor" as const },
      ],
      dayBudgetIntent: "free" as const,
      support: [],
      meals: [],
    };
  }

  it("picks a beach-primary landmark on beach theme days", () => {
    const plan = sdPlan();
    const anchor = selectAnchorForDay(city, plan, beachDayBlueprint(plan), {
      ledgerNames: new Set(),
    });
    expect(anchor.interestTags).toContain("beaches");
    expect(isShorelineBeachExperience(anchor)).toBe(true);
    expect(anchor.indoor && anchor.adultPrice > 0).toBeFalsy();
  });

  it("picks a shoreline beach anchor, not a bay park", () => {
    const plan = sdPlan();
    const anchor = selectAnchorForDay(city, plan, beachDayBlueprint(plan), {
      ledgerNames: new Set(),
    });
    expect(isShorelineBeachExperience(anchor)).toBe(true);
    expect(anchor.name).not.toMatch(/Mission Bay Park/i);
  });

  it("keeps arrival near stay and free/flexible (not Torrey Pines)", () => {
    const plan = sdPlan();
    const bp = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const arrival = bp.days.find((d) => d.role === "arrival")!;
    const anchor = selectAnchorForDay(city, plan, arrival, { ledgerNames: new Set() });
    const km = haversineKm(anchor.lat, anchor.lng, plan.stayLat!, plan.stayLng!);
    expect(km).toBeLessThanOrEqual(LOW_FRICTION_STAY_KM);
    expect(anchor.adultPrice).toBe(0);
    expect(anchor.name).not.toMatch(/Torrey Pines|Birch Aquarium/i);
  });

  it("avoids paid aquariums as departure anchors when free near-stay options exist", () => {
    const plan = sdPlan();
    const bp = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const departure = bp.days.find((d) => d.role === "departure")!;
    const anchor = selectAnchorForDay(city, plan, departure, { ledgerNames: new Set() });
    expect(anchor.adultPrice).toBe(0);
    expect(anchor.name).not.toMatch(/Birch Aquarium/i);
  });

  it("picks indoor play for play_indoor theme, not outdoor playgrounds", () => {
    const plan = sdPlan();
    const bp = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    let day = bp.days.find((d) => d.theme.id === "play_indoor");
    if (!day) {
      // Force a play_indoor day blueprint for the selector rule
      day = {
        ...bp.days[1]!,
        theme: {
          id: "play_indoor",
          label: "Play indoor",
          primaryTags: ["indoor-play"],
          secondaryTags: ["entertainment"],
          preferredExperienceTypes: ["indoor-play", "entertainment"],
        },
        constraints: [
          {
            type: "anchor_primary_tags",
            tags: ["indoor-play"],
            mode: "any",
          },
        ],
      };
    }
    const anchor = selectAnchorForDay(city, plan, day, { ledgerNames: new Set() });
    expect(isIndoorPlayExperience(anchor)).toBe(true);
    expect(isOutdoorPlayground(anchor)).toBe(false);
  });
});

describe("commitStopsToBlueprint", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("hard-excludes full-day anchors across days (travel days may soft-reuse near stay)", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const committed = commitStopsToBlueprint(themed, plan, city);
    const fullNames = committed.days
      .filter((d) => d.role === "full")
      .map((d) => d.anchor!.landmarkName);
    expect(new Set(fullNames).size).toBe(fullNames.length);
    expect(committed.ledger.landmarkNames.length).toBeGreaterThanOrEqual(fullNames.length);
  });

  it("does not reuse a full-day indoor-play anchor while unused landmarks remain", () => {
    const tinyCity = {
      ...city,
      id: "places:dallas-tiny",
      name: "Dallas",
      landmarks: [
        {
          name: "Kids Empire Dallas Hillcrest",
          lat: 32.84,
          lng: -96.78,
          adultPrice: 25,
          openingHours: { open: "09:00", close: "18:00" },
          intensity: "high" as const,
          ageTags: ["toddler", "child"] as const,
          interestTags: ["indoor-play", "playgrounds"] as const,
          indoor: true,
        },
        {
          name: "Dallas Zoo",
          lat: 32.74,
          lng: -96.81,
          adultPrice: 30,
          openingHours: { open: "09:00", close: "17:00" },
          intensity: "medium" as const,
          ageTags: ["toddler", "child", "tween"] as const,
          interestTags: ["zoos"] as const,
          indoor: false,
        },
        {
          name: "Perot Museum",
          lat: 32.78,
          lng: -96.8,
          adultPrice: 25,
          openingHours: { open: "10:00", close: "17:00" },
          intensity: "medium" as const,
          ageTags: ["child", "tween", "teen"] as const,
          interestTags: ["museums", "interactive"] as const,
          indoor: true,
        },
        {
          name: "Klyde Warren Park",
          lat: 32.79,
          lng: -96.8,
          adultPrice: 0,
          openingHours: { open: "08:00", close: "20:00" },
          intensity: "low" as const,
          ageTags: ["toddler", "child", "tween", "teen"] as const,
          interestTags: ["parks"] as const,
          indoor: false,
        },
      ],
    };
    const plan = sdPlan({
      destination: "Dallas, TX",
      interests: ["Playgrounds & Indoor Play", "Zoos & Aquariums", "Museums & Art", "Parks & Gardens"],
    });
    const themed = applyDailyThemes(buildTripStrategy(plan, { city: tinyCity }), plan, tinyCity);
    const committed = commitStopsToBlueprint(themed, plan, tinyCity);
    const fullAnchors = committed.days
      .filter((d) => d.role === "full")
      .map((d) => d.anchor!.landmarkName);
    expect(fullAnchors.filter((n) => n === "Kids Empire Dallas Hillcrest").length).toBeLessThanOrEqual(
      1,
    );
    expect(new Set(fullAnchors).size).toBe(fullAnchors.length);
  });

  it("keeps departure within low-friction stay distance even when near POIs are ledger-used", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const committed = commitStopsToBlueprint(themed, plan, city);
    const departure = committed.days.find((d) => d.role === "departure")!;
    const anchor = city.landmarks.find((l) => l.name === departure.anchor!.landmarkName)!;
    const km = haversineKm(anchor.lat, anchor.lng, plan.stayLat!, plan.stayLng!);
    expect(km).toBeLessThanOrEqual(LOW_FRICTION_STAY_KM);
    expect(anchor.adultPrice).toBe(0);
    expect(anchor.name).not.toMatch(/Torrey Pines|Birch Aquarium/i);
  });

  it("picks light near-stay arrival support, not a museum campus", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const committed = commitStopsToBlueprint(themed, plan, city);
    const arrival = committed.days.find((d) => d.role === "arrival")!;
    expect(arrival.support.length).toBeGreaterThan(0);
    const anchor = city.landmarks.find((l) => l.name === arrival.anchor!.landmarkName)!;
    const support = city.landmarks.find((l) => l.name === arrival.support[0]!.landmarkName)!;
    const km = haversineKm(support.lat, support.lng, plan.stayLat!, plan.stayLng!);
    expect(km).toBeLessThanOrEqual(LOW_FRICTION_STAY_KM);
    expect(support.adultPrice).toBe(0);
    expect(support.interestTags.includes("museums")).toBe(false);
    expect(support.name).not.toMatch(/Balboa Park/i);
    expect(sharesDayActivityCategory(anchor, support)).toBe(false);
    expect(support.name).not.toMatch(/Coronado Beach/i);
  });

  it("assigns a shoreline beach anchor on beach theme days end-to-end", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const committed = commitStopsToBlueprint(themed, plan, city);
    const beachDay = committed.days.find((d) => d.theme.id === "beach");
    expect(beachDay).toBeDefined();
    const anchor = city.landmarks.find((l) => l.name === beachDay!.anchor!.landmarkName)!;
    expect(isShorelineBeachExperience(anchor)).toBe(true);
    expect(anchor.name).not.toMatch(/Mission Bay Park/i);
  });

  it("does not let outdoor playgrounds satisfy indoor-play coverage", () => {
    const plan = sdPlan();
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const committed = commitStopsToBlueprint(themed, plan, city);
    const indoor = committed.experienceCoverage.items.find((i) => i.key === "indoor-play");
    const outdoor = committed.experienceCoverage.items.find((i) => i.key === "playgrounds");
    expect(indoor).toBeDefined();
    expect(outdoor).toBeDefined();

    for (const day of committed.days) {
      if (day.theme.id !== "play_indoor" || !day.anchor) continue;
      const lm = city.landmarks.find((l) => l.name === day.anchor!.landmarkName)!;
      expect(isIndoorPlayExperience(lm)).toBe(true);
    }
  });

  it("limits mixed families to at most one toddler-only full day", () => {
    const plan = sdPlan({ children: [2, 10] });
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const committed = commitStopsToBlueprint(themed, plan, city);
    const toddlerOnly = committed.days.filter((d) => {
      if (d.role !== "full") return false;
      const stops = [d.anchor!, ...d.support]
        .map((s) => city.landmarks.find((l) => l.name === s.landmarkName))
        .filter(Boolean);
      return (
        stops.length > 0 &&
        stops.every(
          (l) =>
            l!.ageTags.length > 0 &&
            !l!.ageTags.some((t) => t === "tween" || t === "teen") &&
            l!.ageTags.every((t) => t === "toddler" || t === "child"),
        )
      );
    });
    expect(toddlerOnly.length).toBeLessThanOrEqual(1);
  });
});

describe("planTrip staged engine", () => {
  const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("uses blueprint anchors in activity titles when plannerEngine=staged", () => {
    const plan = sdPlan();
    const { raw, plannerEngine, blueprint } = planTrip(plan, {
      cityOverride: city,
      plannerEngine: "staged",
    });
    expect(plannerEngine).toBe("staged");
    expect(blueprint?.days.every((d) => d.anchor)).toBe(true);

    const titles = activityTitlesByDay(raw).flat().join(" | ");
    for (const day of blueprint!.days) {
      expect(titles).toContain(day.anchor!.landmarkName);
    }
  });

  it("does not clone the same activity pair across 3+ days", () => {
    const plan = sdPlan();
    const { raw } = planTrip(plan, { cityOverride: city, plannerEngine: "staged" });
    const pairs = activityTitlesByDay(raw).map((t) => t.join("||"));
    const counts = new Map<string, number>();
    for (const p of pairs) counts.set(p, (counts.get(p) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThan(3);
  });

  it("defaults to staged engine with committed anchors for callers", () => {
    const { plannerEngine, blueprint } = planTrip(sdPlan(), { cityOverride: city });
    expect(plannerEngine).toBe("staged");
    expect(blueprint?.days.every((d) => d.anchor)).toBe(true);
  });

  it("balanced budget avoids San Diego Zoo and never stacks two heavy stops on one day", () => {
    const plan = sdPlan({
      interests: [
        "Zoos & Animals",
        "Shows & Entertainment",
        "Playgrounds & Indoor Play",
        "Interactive Museums",
        "Beaches & Waterfronts",
      ],
    });
    const { raw, blueprint } = planTrip(plan, { cityOverride: city, plannerEngine: "staged" });
    const titles = raw.days.flatMap((d) => d.activities.map((a) => a.title)).join(" | ");
    expect(titles).not.toMatch(/San Diego Zoo/i);

    for (const day of blueprint!.days) {
      const stops = [day.anchor!, ...day.support]
        .map((s) => city.landmarks.find((l) => l.name === s.landmarkName))
        .filter(Boolean);
      const heavy = stops.filter((l) => isHeavyDayLandmark(l!));
      expect(heavy.length).toBeLessThanOrEqual(1);
      for (const lm of stops) {
        expect(exceedsBudgetStyleTicket(lm!, plan.budgetStyle)).toBe(false);
      }
    }
  });

  it("selects chill support for Belmont Park, not Children's Museum", () => {
    const plan = sdPlan({
      interests: [
        "Shows & Entertainment",
        "Interactive Museums",
        "Playgrounds & Indoor Play",
        "Beaches & Waterfronts",
      ],
    });
    const belmont = city.landmarks.find((l) => l.name === "Belmont Park")!;
    const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const entertainmentDay = {
      ...themed.days[1]!,
      role: "full" as const,
      theme: {
        id: "entertainment" as const,
        label: "Entertainment",
        primaryTags: ["entertainment" as const],
        secondaryTags: ["theme-parks" as const],
        preferredExperienceTypes: ["entertainment" as const, "theme-parks" as const],
      },
      constraints: [
        {
          type: "anchor_primary_tags" as const,
          tags: ["entertainment" as const],
          mode: "any" as const,
        },
      ],
      dayBudgetIntent: "paid" as const,
      support: [],
      meals: [],
    };
    const ledgerNames = new Set(
      city.landmarks.map((l) => l.name).filter((n) => n !== belmont.name),
    );
    const support = selectSupportForDay(city, plan, entertainmentDay, belmont, {
      ledgerNames,
      alreadyToday: [belmont],
    });

    for (const stop of support) {
      expect(pairingAllowedForDay(belmont, stop)).toBe(true);
      expect(stop.name).not.toMatch(/Children's Museum/i);
    }
  });
});
