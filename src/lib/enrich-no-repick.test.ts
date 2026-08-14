import { describe, expect, it, vi } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import type { TripPlan } from "@/types/trip-plan";

function plan(): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-15",
    endDate: "2026-09-16",
    adults: 1,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Beaches & Waterfronts", "Interactive Museums"],
  };
}

describe("enrichItinerary never re-picks landmarks", () => {
  it("keeps the titled landmark even when it is far / already 'used'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const torrey = sanDiego.landmarks.find(
      (l) => l.name === "Torrey Pines State Natural Reserve",
    )!;
    const fleet = sanDiego.landmarks.find((l) => l.name === "Fleet Science Center")!;

    const enriched = await enrichItinerary(
      {
        days: [
          {
            day: 1,
            activities: [
              {
                time: "10:00",
                title: "Explore Torrey Pines State Natural Reserve",
                type: "activity",
                slotKind: "morning_activity",
              },
              {
                time: "14:00",
                title: "Explore Fleet Science Center",
                type: "activity",
                slotKind: "afternoon_activity",
              },
            ],
          },
        ],
      },
      plan(),
    );

    const morning = enriched.days[0]!.activities.find((a) =>
      a.title.includes("Torrey Pines"),
    )!;
    const afternoon = enriched.days[0]!.activities.find((a) =>
      a.title.includes("Fleet Science Center"),
    )!;

    expect(morning.location?.name).toBe(torrey.name);
    expect(morning.location?.lat).toBe(torrey.lat);
    expect(afternoon.location?.name).toBe(fleet.name);
    expect(afternoon.location?.lat).toBe(fleet.lat);
  });

  it("does not invent a different POI when the title landmark is unknown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const fleet = sanDiego.landmarks.find((l) => l.name === "Fleet Science Center")!;

    const enriched = await enrichItinerary(
      {
        days: [
          {
            day: 1,
            activities: [
              {
                time: "10:00",
                title: "Explore Fleet Science Center",
                type: "activity",
                slotKind: "morning_activity",
              },
              {
                time: "15:00",
                title: "Explore Mystery Garden of Unlisted Places",
                type: "activity",
                slotKind: "afternoon_activity",
              },
            ],
          },
        ],
      },
      plan(),
    );

    const mystery = enriched.days[0]!.activities.find((a) =>
      a.title.includes("Mystery Garden"),
    )!;
    // Title preserved; coords pin to last known stop — never swap to a catalog pick.
    expect(mystery.title).toContain("Mystery Garden");
    expect(mystery.location?.name).toMatch(/Mystery Garden|Fleet Science Center/);
    expect(mystery.location?.lat).toBe(fleet.lat);
    expect(mystery.location?.name).not.toBe(sanDiego.landmarks[0]!.name);
  });
});
