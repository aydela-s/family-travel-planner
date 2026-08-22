import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, DEFAULT_CITY } from "@/config/city-pricing";
import { PUBLIC_TRANSIT_CLUSTER_KM } from "@/config/cluster-distances";
import { planTrip } from "@/lib/planning-engine";
import {
  isPublicTransitSelectable,
  limitedTransitWarning,
  resolveTransitSelection,
  transitScheduleIsDifficult,
  transportationOptionsForCity,
  unavailableTransitNote,
} from "@/lib/planning-engine/transit-mode";
import { TripPlan } from "@/types/trip-plan";
import { RawItinerary } from "@/types/itinerary";

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego, CA",
    startDate: "2026-09-15",
    endDate: "2026-09-15",
    adults: 2,
    children: [5],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    dietaryRestrictions: "",
    naps: null,
    budgetStyle: "balanced",
    interests: ["Zoos & Aquariums", "Swimming & Water Play", "Parks & Gardens"],
    accommodationType: "hotel_no_breakfast",
    stayAddress: "",
    ...overrides,
  };
}

describe("transit quality gates", () => {
  it("rates San Diego limited and DEFAULT none", () => {
    expect(CITY_CONFIGS.find((c) => c.id === "san-diego")?.transitQuality).toBe("limited");
    expect(DEFAULT_CITY.transitQuality).toBe("none");
    expect(CITY_CONFIGS.find((c) => c.id === "london")?.transitQuality).toBe("good");
    expect(CITY_CONFIGS.find((c) => c.id === "paris")?.transitQuality).toBe("good");
  });

  it("keeps public transit visible but unselectable for none cities", () => {
    expect(transportationOptionsForCity(DEFAULT_CITY)).toEqual([
      "car-rental",
      "taxis",
      "public-transportation",
    ]);
    expect(isPublicTransitSelectable(DEFAULT_CITY)).toBe(false);
    expect(unavailableTransitNote({ ...DEFAULT_CITY, name: "Boise" })).toMatch(/isn’t available/i);

    const london = CITY_CONFIGS.find((c) => c.id === "london")!;
    expect(isPublicTransitSelectable(london)).toBe(true);
    expect(unavailableTransitNote(london)).toBeNull();

    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    expect(isPublicTransitSelectable(sanDiego)).toBe(true);
    expect(limitedTransitWarning(sanDiego)).toMatch(/limited/i);
    expect(limitedTransitWarning(london)).toBeNull();
  });

  it("forces taxis when public transit is selected for a none city", () => {
    const resolved = resolveTransitSelection(
      basePlan({ destination: "Boise, ID", transportationType: "public-transportation" }),
      { ...DEFAULT_CITY, name: "Boise" },
    );
    expect(resolved.switched).toBe(true);
    expect(resolved.plan.transportationType).toBe("taxis");
    expect(resolved.transportNote).toMatch(/taxis/i);
  });

  it("flags limited-city schedules with long consecutive legs as difficult", () => {
    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const raw: RawItinerary = {
      days: [
        {
          day: 1,
          activities: [
            {
              time: "10:00",
              title: "Visit Balboa Park",
              type: "activity",
            },
            {
              time: "14:00",
              title: "Explore La Jolla Cove",
              type: "activity",
            },
          ],
        },
      ],
    };
    const plan = basePlan();
    expect(transitScheduleIsDifficult(raw, plan, sanDiego)).toBe(true);

    const shortRaw: RawItinerary = {
      days: [
        {
          day: 1,
          activities: [
            { time: "10:00", title: "Visit Balboa Park", type: "activity" },
            { time: "14:00", title: "Visit San Diego Zoo", type: "activity" },
          ],
        },
      ],
    };
    // Zoo is next to Balboa — should be within cluster
    const shortKmOk = !transitScheduleIsDifficult(shortRaw, plan, sanDiego);
    // Document threshold used by the rule
    expect(PUBLIC_TRANSIT_CLUSTER_KM).toBe(5);
    expect(shortKmOk).toBe(true);
  });

  it("planTrip San Diego + public transit falls back to taxis with a note when hard", () => {
    const { plan, transportNote } = planTrip(
      basePlan({
        // Multi-day + far-flung interests force long consecutive legs in SD.
        startDate: "2026-09-15",
        endDate: "2026-09-19",
        travelStyle: "packed",
        interests: ["Zoos & Aquariums", "Swimming & Water Play", "Parks & Gardens", "Theme Parks"],
      }),
      { plannerEngine: "score" },
    );
    expect(plan.transportationType).toBe("taxis");
    expect(transportNote).toMatch(/San Diego/i);
    expect(transportNote).toMatch(/taxis/i);
  });

  it("planTrip London + public transit keeps transit without a note", () => {
    const { plan, transportNote } = planTrip(basePlan({
        destination: "London, UK",
        interests: ["Museums & Art", "Parks & Gardens", "Playgrounds"],
      }), { plannerEngine: "score" });
    expect(plan.transportationType).toBe("public-transportation");
    expect(transportNote).toBeUndefined();
  });

  it("planTrip unknown city with public transit forces taxis", () => {
    const { plan, transportNote } = planTrip(basePlan({ destination: "Boise, Idaho" }), { plannerEngine: "score" });
    expect(plan.transportationType).toBe("taxis");
    expect(transportNote).toBeTruthy();
  });
});
