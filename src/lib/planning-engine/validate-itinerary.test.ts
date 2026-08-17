import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, type CityConfig, type Landmark } from "@/config/city-pricing";
import {
  duplicateDayCategories,
  enforceDayCategoryUniqueness,
  mealDetoursForDay,
  repairUncoveredSelectedInterests,
  validateItinerary,
} from "@/lib/planning-engine/validate-itinerary";
import {
  classifyActivities,
  classifyActivityInterestTags,
  inferInterestTagsFromName,
} from "@/lib/schedule/classify-activity";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

function plan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "Denver",
    startDate: "2026-09-15",
    endDate: "2026-09-19",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: [
      "Swimming & Water Play",
      "Nature & Scenic Views",
      "Playgrounds & Indoor Play",
      "Interactive Museums",
      "Shopping",
    ],
    ...overrides,
  };
}

/** ~0.009° latitude ≈ 1 km, so fixtures read in kilometers north of the anchor. */
function at(kmNorth: number): { lat: number; lng: number } {
  return { lat: 39.74 + kmNorth * 0.009, lng: -104.99 };
}

function activity(
  title: string,
  interestTags: Landmark["interestTags"],
  kmNorth = 0,
): ItineraryActivity {
  return {
    time: "10:00",
    endTime: "12:00",
    title,
    type: "activity",
    interestTags,
    location: { name: title, ...at(kmNorth) },
  };
}

function mealAt(title: string, kmNorth: number): ItineraryActivity {
  return {
    time: "12:30",
    endTime: "13:30",
    title,
    type: "meal",
    slotKind: "lunch",
    location: { name: title, ...at(kmNorth) },
  };
}

function day(activities: ItineraryActivity[], dayNumber = 1): ItineraryDay {
  return {
    day: dayNumber,
    date: "2026-09-15",
    title: `Day ${dayNumber}`,
    activities,
    routeSegments: [],
    dailyCost: 0,
  } as ItineraryDay;
}

const city: CityConfig = {
  ...CITY_CONFIGS[0]!,
  id: "test-city",
  landmarks: [
    { ...activityLandmark("Water Park", ["beaches"], 1) },
    { ...activityLandmark("Scenic Overlook", ["nature"], 2) },
    { ...activityLandmark("Kids Discovery Lab", ["interactive"], 2.5) },
    { ...activityLandmark("Big Mall", ["shopping"], 40) },
  ],
};

function activityLandmark(
  name: string,
  interestTags: Landmark["interestTags"],
  kmNorth: number,
): Landmark {
  return {
    name,
    ...at(kmNorth),
    adultPrice: 0,
    openingHours: { open: "09:00", close: "18:00" },
    intensity: "medium",
    ageTags: ["child"],
    interestTags,
    indoor: false,
  };
}

describe("HARD RULE — one activity per category per day", () => {
  it("flags two nature stops on the same day", () => {
    const d = day([
      activity("Scenic Overlook", ["nature"]),
      activity("Mountain Lookout", ["nature"], 3),
    ]);
    expect(duplicateDayCategories(d)).toEqual(["nature"]);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).toContain(
      "duplicate_day_category",
    );
  });

  it("accepts different categories on the same day", () => {
    const d = day([
      activity("Scenic Overlook", ["nature"]),
      activity("Kids Discovery Lab", ["interactive"], 2),
      activity("Water Park", ["beaches"], 3),
    ]);
    expect(duplicateDayCategories(d)).toEqual([]);
  });

  it("flags duplicates regardless of how many stops the day has", () => {
    const d = day([
      activity("Scenic Overlook", ["nature"]),
      activity("Kids Discovery Lab", ["interactive"], 1),
      activity("Another Trailhead", ["nature"], 2),
      activity("Water Park", ["beaches"], 3),
    ]);
    expect(duplicateDayCategories(d)).toEqual(["nature"]);
  });

  it("replaces the repeat with a different selected category rather than renaming it", () => {
    const d = day([
      activity("Scenic Overlook", ["nature"], 2),
      activity("Mountain Lookout", ["nature"], 3),
    ]);
    const [fixed] = enforceDayCategoryUniqueness([d], plan(), city);
    expect(duplicateDayCategories(fixed!)).toEqual([]);
    const tags = fixed!.activities.flatMap((a) => a.interestTags ?? []);
    expect(tags.filter((t) => t === "nature")).toHaveLength(1);
    // The replacement is a real, different stop — not the same venue relabelled.
    const names = fixed!.activities.map((a) => a.location?.name);
    expect(names).not.toContain("Mountain Lookout");
  });

  it("prefers an uncovered selected interest for the replacement", () => {
    const d = day([
      activity("Scenic Overlook", ["nature"], 2),
      activity("Mountain Lookout", ["nature"], 3),
    ]);
    const [fixed] = enforceDayCategoryUniqueness([d], plan(), city);
    const replacement = fixed!.activities[1]!;
    expect(replacement.interestTags?.some((t) => ["beaches", "interactive", "shopping"].includes(t))).toBe(
      true,
    );
  });

  it("drops the repeat when no different category is available", () => {
    const natureOnlyCity: CityConfig = {
      ...city,
      landmarks: [activityLandmark("Scenic Overlook", ["nature"], 2)],
    };
    const d = day([
      activity("Scenic Overlook", ["nature"], 2),
      activity("Mountain Lookout", ["nature"], 3),
    ]);
    const [fixed] = enforceDayCategoryUniqueness([d], plan(), natureOnlyCity);
    expect(fixed!.activities).toHaveLength(1);
    expect(duplicateDayCategories(fixed!)).toEqual([]);
  });
});

describe("HARD RULE — stops that arrive without catalog tags", () => {
  /** A stop the planner never tagged: only a name and a pin. */
  function untagged(title: string, kmNorth = 0): ItineraryActivity {
    const a = activity(title, [], kmNorth);
    delete a.interestTags;
    return a;
  }

  it("classifies an untagged venue from its name", () => {
    expect(inferInterestTagsFromName("Denver Art Museum")).toEqual(["museums"]);
    expect(inferInterestTagsFromName("Clyfford Still Gallery")).toEqual(["museums"]);
    expect(inferInterestTagsFromName("Cheesman Park")).toEqual(["parks"]);
    // Most specific rule wins over the generic "park" match.
    expect(inferInterestTagsFromName("Zoo Safari Park")).toEqual(["zoos"]);
    expect(inferInterestTagsFromName("Children's Museum of Denver")).toEqual(["interactive"]);
    expect(inferInterestTagsFromName("Some Unnameable Venue")).toEqual([]);
  });

  it("prefers the matching city landmark over the name guess", () => {
    // Named like a park, catalogued as nature — the catalog wins.
    const cityWithLandmark: CityConfig = {
      ...city,
      landmarks: [...city.landmarks, activityLandmark("Lookout Park", ["nature"], 2)],
    };
    expect(classifyActivityInterestTags(untagged("Lookout Park", 2), cityWithLandmark)).toEqual([
      "nature",
    ]);
  });

  it("catches two untagged stops that resolve to the same category", () => {
    const d = day([untagged("Denver Art Museum", 1), untagged("Clyfford Still Gallery", 2)]);
    // Neither stop carries tags, yet both are museums.
    expect(d.activities.every((a) => !a.interestTags)).toBe(true);
    expect(duplicateDayCategories(d)).toEqual(["museums"]);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).toContain(
      "duplicate_day_category",
    );
  });

  it("repairs a day whose duplicate only exists after classification", () => {
    const d = day([untagged("Denver Art Museum", 1), untagged("Clyfford Still Gallery", 2)]);
    const [fixed] = enforceDayCategoryUniqueness([d], plan(), city);
    expect(duplicateDayCategories(fixed!)).toEqual([]);
    const museums = fixed!.activities.filter((a) =>
      (a.interestTags ?? []).includes("museums"),
    );
    expect(museums).toHaveLength(1);
    expect(fixed!.activities.map((a) => a.location?.name)).not.toContain("Clyfford Still Gallery");
  });

  it("classifies stops during enrichment so both kinds of duplicate are equivalent", () => {
    const classified = classifyActivities(
      [untagged("Denver Art Museum", 1), untagged("Clyfford Still Gallery", 2)],
      city,
    );
    expect(classified.map((a) => a.interestTags)).toEqual([["museums"], ["museums"]]);
  });

  it("leaves a stop that cannot be classified out of category balancing", () => {
    const d = day([untagged("Some Unnameable Venue", 1), untagged("Another Mystery Stop", 2)]);
    // No category can be inferred, so these neither claim nor conflict.
    expect(duplicateDayCategories(d)).toEqual([]);
    expect(classifyActivities(d.activities, city).every((a) => !a.interestTags)).toBe(true);
  });
});

describe("selected interests drive the plan", () => {
  it("flags an activity from a category the family never selected", () => {
    const d = day([activity("Rose Garden", ["parks"])]);
    const codes = validateItinerary([d], plan(), city).map((v) => v.code);
    expect(codes).toContain("unselected_category_filler");
  });

  it("does not flag activities that match a selected interest", () => {
    const d = day([activity("Water Park", ["beaches"])]);
    const codes = validateItinerary([d], plan(), city).map((v) => v.code);
    expect(codes).not.toContain("unselected_category_filler");
  });

  it("reports selected interests that were never scheduled across the trip", () => {
    const days = [
      day([activity("Water Park", ["beaches"])], 1),
      day([activity("Scenic Overlook", ["nature"])], 2),
    ];
    const uncovered = validateItinerary(days, plan(), city)
      .filter((v) => v.code === "uncovered_selected_interest")
      .map((v) => v.message);
    expect(uncovered.join(" ")).toMatch(/Shopping/i);
    expect(uncovered.join(" ")).toMatch(/Interactive/i);
  });

  it("passes coverage once every selected interest appears", () => {
    const days = [
      day([activity("Water Park", ["beaches"]), activity("Scenic Overlook", ["nature"], 1)], 1),
      day(
        [
          activity("Kids Discovery Lab", ["interactive"]),
          activity("Neighborhood Playground", ["playgrounds"], 1),
          activity("Big Mall", ["shopping"], 2),
        ],
        2,
      ),
    ];
    const codes = validateItinerary(days, plan(), city).map((v) => v.code);
    expect(codes).not.toContain("uncovered_selected_interest");
  });

  it("swaps an off-interest filler for a nearby uncovered selected interest", () => {
    const days = [day([activity("Local history exhibit", ["history"])])];
    const repaired = repairUncoveredSelectedInterests(days, plan(), {
      ...city,
      landmarks: [
        ...city.landmarks,
        activityLandmark("Splash Factory", ["beaches"], 2),
      ],
    });
    const tags = repaired[0]!.activities.flatMap((a) => a.interestTags ?? []);
    expect(tags).toContain("beaches");
  });
});

describe("restaurants must sit on the day's route", () => {
  it("measures the backtracking a meal adds", () => {
    const d = day([
      activity("Water Park", ["beaches"], 0),
      mealAt("Lunch at Far Away Cafe", 40),
      activity("Kids Discovery Lab", ["interactive"], 3),
    ]);
    const [detour] = mealDetoursForDay(d);
    expect(detour!.km).toBeGreaterThan(70);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).toContain(
      "restaurant_detour",
    );
  });

  it("accepts a meal between the two stops", () => {
    const d = day([
      activity("Water Park", ["beaches"], 0),
      mealAt("Lunch at Corner Cafe", 2),
      activity("Kids Discovery Lab", ["interactive"], 4),
    ]);
    expect(mealDetoursForDay(d)[0]!.km).toBeLessThan(1);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).not.toContain(
      "restaurant_detour",
    );
  });
});

describe("display and cost invariants", () => {
  it("flags a distance shown in kilometers", () => {
    const d = day([
      { ...activity("Water Park", ["beaches"]), type: "travel", notes: "13.5 km · ~15 min driving" },
    ]);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).toContain(
      "distance_not_in_miles",
    );
  });

  it("accepts a distance shown in miles", () => {
    const d = day([
      { ...activity("Water Park", ["beaches"]), type: "travel", notes: "8.4 mi · ~15 min driving" },
    ]);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).not.toContain(
      "distance_not_in_miles",
    );
  });

  it("flags a meal cost that ignores the traveler composition", () => {
    const d = day([{ ...mealAt("Lunch at Corner Cafe", 1), activityCost: 300 }]);
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).toContain(
      "meal_cost_mismatch",
    );
  });

  it("flags a driving leg that does not match fuel plus parking", () => {
    const d: ItineraryDay = {
      ...day([activity("Water Park", ["beaches"])]),
      routeSegments: [
        {
          from: "Stay",
          to: "Water Park",
          distanceKm: 8.4,
          durationMin: 12,
          cost: 99,
          fuelCost: 1,
          parkingCost: 10,
        },
      ],
    };
    expect(validateItinerary([d], plan(), city).map((v) => v.code)).toContain(
      "transport_cost_mismatch",
    );
  });
});
