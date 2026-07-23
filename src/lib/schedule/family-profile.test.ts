import { describe, expect, it } from "vitest";
import { CITY_CONFIGS, Landmark } from "@/config/city-pricing";
import { buildLandmarkContext } from "@/lib/planning-engine/slot-filler";
import {
  CAR_CLUSTER_KM,
  clusterRadiusKm,
  maxPairwiseDistanceKm,
  minDistanceKmToPicked,
  pickLandmarkForFamily,
  SAME_DAY_CLUSTER_KM,
  stayProximityScore,
  TIGHT_CLUSTER_KM,
} from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function basePlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    destination: "San Diego",
    startDate: isoDateOffset(30),
    endDate: isoDateOffset(32),
    adults: 2,
    children: [5, 10],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "hotel_no_breakfast",
    dietaryRestrictions: "",
    napSchedule: "No naps needed",
    budgetStyle: "balanced",
    interests: [],
    ...overrides,
  };
}

describe("same-day landmark proximity — Phase 3", () => {
  const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
  const paris = CITY_CONFIGS.find((c) => c.id === "paris")!;

  it("prefers a nearby landmark over a distant one after the morning pick", () => {
    const plan = basePlan({ budgetStyle: "balanced" });
    const balboa = sanDiego.landmarks.find((l) => l.name === "Balboa Park")!;
    const laJolla = sanDiego.landmarks.find((l) => l.name === "La Jolla Cove")!;

    const afternoon = pickLandmarkForFamily(sanDiego, plan, 1, 1, [balboa]);

    expect(afternoon.name).not.toBe("La Jolla Cove");
    expect(minDistanceKmToPicked(afternoon, [balboa])).toBeLessThan(
      minDistanceKmToPicked(laJolla, [balboa]),
    );
    expect(minDistanceKmToPicked(afternoon, [balboa])).toBeLessThanOrEqual(SAME_DAY_CLUSTER_KM);
  });

  it("buildLandmarkContext keeps morning + afternoon within the cluster radius when possible", () => {
    const plan = basePlan({ destination: "Paris", budgetStyle: "balanced" });
    const ctx = buildLandmarkContext(paris, plan, 1, 2);
    const activityStops = [ctx.morning, ctx.afternoon];
    const spread = maxPairwiseDistanceKm(activityStops);

    // Paris center landmarks are ~2–4 km apart; Montmartre is farther.
    expect(spread).toBeLessThanOrEqual(SAME_DAY_CLUSTER_KM);
    expect(ctx.morning.name).not.toBe(ctx.afternoon.name);
  });

  it("does not reuse the same landmark for morning and afternoon when alternatives exist", () => {
    const plan = basePlan({ budgetStyle: "balanced" });
    const ctx = buildLandmarkContext(sanDiego, plan, 1, 2);
    expect(ctx.morning.name).not.toBe(ctx.afternoon.name);
  });

  it("avoids La Jolla as the second stop when morning is downtown and mid/premium picks are allowed", () => {
    const plan = basePlan({ budgetStyle: "balanced" });
    for (let day = 1; day <= 6; day++) {
      const morning = pickLandmarkForFamily(sanDiego, plan, day, 0, []);
      if (morning.name === "Balboa Park" || morning.name === "San Diego Zoo" || morning.name === "USS Midway Museum") {
        const afternoon = pickLandmarkForFamily(sanDiego, plan, day, 1, [morning]);
        expect(afternoon.name).not.toBe("La Jolla Cove");
      }
    }
  });

  it("with only far free options left and no nearby paid stops, still picks the nearest remaining", () => {
    // Isolated catalog: two free landmarks far apart — clustering cannot invent a third stop.
    const islandCity = {
      ...sanDiego,
      landmarks: [
        {
          name: "North Park",
          lat: 32.75,
          lng: -117.13,
          adultPrice: 0,
          openingHours: { open: "08:00", close: "20:00" },
          intensity: "low" as const,
          ageTags: ["child" as const],
          interestTags: ["parks" as const],
          indoor: false,
        },
        {
          name: "South Beach",
          lat: 32.7,
          lng: -117.25,
          adultPrice: 0,
          openingHours: { open: "08:00", close: "20:00" },
          intensity: "low" as const,
          ageTags: ["child" as const],
          interestTags: ["beaches" as const],
          indoor: false,
        },
      ],
    };
    const plan = basePlan({ budgetStyle: "save" });
    const first = pickLandmarkForFamily(islandCity, plan, 1, 0, []);
    const second = pickLandmarkForFamily(islandCity, plan, 1, 1, [first]);
    expect(second.name).not.toBe(first.name);
    expect(minDistanceKmToPicked(second, [first])).toBeGreaterThan(SAME_DAY_CLUSTER_KM);
  });

  it("expands beyond the cheap tier when a nearby paid landmark keeps the day clustered", () => {
    const plan = basePlan({ budgetStyle: "save" });
    const balboa = sanDiego.landmarks.find((l) => l.name === "Balboa Park")!;
    const afternoon = pickLandmarkForFamily(sanDiego, plan, 1, 1, [balboa]);
    // Zoo is ~0.5 km from Balboa; La Jolla is ~15 km.
    expect(afternoon.name).not.toBe("La Jolla Cove");
    expect(minDistanceKmToPicked(afternoon, [balboa])).toBeLessThanOrEqual(SAME_DAY_CLUSTER_KM);
  });

  it("maxPairwiseDistanceKm returns 0 for a single landmark", () => {
    expect(maxPairwiseDistanceKm([sanDiego.landmarks[0]])).toBe(0);
  });
});

describe("car rental — wider day distances", () => {
  const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;

  it("uses a wider same-day cluster radius than transit or walking", () => {
    expect(clusterRadiusKm(basePlan({ transportationType: "car-rental" }))).toBe(CAR_CLUSTER_KM);
    expect(clusterRadiusKm(basePlan({ transportationType: "public-transportation" }))).toBe(
      SAME_DAY_CLUSTER_KM,
    );
    expect(clusterRadiusKm(basePlan({ transportationType: "walking" }))).toBe(TIGHT_CLUSTER_KM);
    expect(CAR_CLUSTER_KM).toBeGreaterThan(SAME_DAY_CLUSTER_KM);
  });

  it("softens stay-distance penalties when driving", () => {
    const far = sanDiego.landmarks.find((l) => l.name === "La Jolla Cove")!;
    const stay = { stayLat: 32.7341, stayLng: -117.1446 };
    const car = stayProximityScore(far, basePlan({ transportationType: "car-rental", ...stay }));
    const transit = stayProximityScore(
      far,
      basePlan({ transportationType: "public-transportation", ...stay }),
    );
    expect(car).toBeGreaterThan(transit);
  });
});
