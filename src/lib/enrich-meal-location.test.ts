import { describe, expect, it, vi } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import { TripPlan } from "@/types/trip-plan";

function plan(): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    adults: 1,
    children: [4, 8],
    travelStyle: "packed",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Theme Parks", "Interactive Museums"],
  };
}

describe("enrich meal locations from title landmarks", () => {
  it("pins café breakfast near Fleet to Fleet Science Center, not landmarks[0]", async () => {
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
                time: "08:00",
                title: "Breakfast near Fleet Science Center",
                type: "meal",
                slotKind: "breakfast",
              },
              {
                time: "10:00",
                title: "Explore Fleet Science Center",
                type: "activity",
                slotKind: "morning_activity",
              },
              {
                time: "12:30",
                title: "Lunch near Belmont Park",
                type: "meal",
                slotKind: "lunch",
              },
              {
                time: "13:30",
                title: "Explore Belmont Park",
                type: "activity",
                slotKind: "afternoon_activity",
              },
              {
                time: "18:00",
                title: "Dinner at Cucina Urbana",
                type: "meal",
                slotKind: "dinner",
              },
            ],
          },
        ],
      },
      plan(),
      { cityOverride: sanDiego },
    );

    const breakfast = enriched.days[0]!.activities.find((a) => a.slotKind === "breakfast")!;
    const lunch = enriched.days[0]!.activities.find((a) => a.slotKind === "lunch")!;

    expect(breakfast.location?.name).toMatch(/Fleet Science Center/i);
    expect(breakfast.location?.name).not.toMatch(/Balboa/i);
    expect(breakfast.location?.lat).toBe(fleet.lat);
    expect(breakfast.location?.lng).toBe(fleet.lng);

    expect(lunch.location?.name).toMatch(/Belmont Park/i);
    expect(lunch.location?.lat).toBe(
      sanDiego.landmarks.find((l) => l.name === "Belmont Park")!.lat,
    );

    vi.unstubAllGlobals();
  });
});
