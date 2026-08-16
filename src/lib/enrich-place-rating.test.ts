import { describe, expect, it, vi } from "vitest";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import { DEFAULT_CITY } from "@/config/city-pricing";
import { TripPlan } from "@/types/trip-plan";

function plan(): TripPlan {
  return {
    destination: "Dallas, TX",
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    adults: 2,
    children: [6],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "taxis",
    accommodationType: "hotel_breakfast_included",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Zoos & Aquariums"],
  };
}

describe("enrichItinerary Places rating passthrough", () => {
  it("copies rating and reviewCount from Places landmarks onto activities", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    const city = {
      ...DEFAULT_CITY,
      id: "places:dallas",
      name: "Dallas",
      landmarks: [
        {
          name: "Dallas Zoo",
          lat: 32.74,
          lng: -96.81,
          adultPrice: 25,
          openingHours: { open: "09:00", close: "17:00" },
          intensity: "medium" as const,
          ageTags: ["child" as const, "tween" as const],
          interestTags: ["zoos" as const],
          indoor: false,
          placeId: "places/dallas-zoo",
          rating: 4.6,
          reviewCount: 12345,
        },
        {
          name: "Perot Museum",
          lat: 32.78,
          lng: -96.8,
          adultPrice: 30,
          openingHours: { open: "10:00", close: "17:00" },
          intensity: "medium" as const,
          ageTags: ["child" as const, "tween" as const],
          interestTags: ["museums" as const, "interactive" as const],
          indoor: true,
          placeId: "places/perot",
          rating: 4.7,
          reviewCount: 8000,
        },
        {
          name: "Klyde Warren Park",
          lat: 32.79,
          lng: -96.8,
          adultPrice: 0,
          openingHours: { open: "06:00", close: "23:00" },
          intensity: "low" as const,
          ageTags: ["toddler" as const, "child" as const],
          interestTags: ["parks" as const],
          indoor: false,
        },
        {
          name: "Dallas Arboretum",
          lat: 32.82,
          lng: -96.71,
          adultPrice: 20,
          openingHours: { open: "09:00", close: "17:00" },
          intensity: "low" as const,
          ageTags: ["child" as const],
          interestTags: ["parks" as const, "nature" as const],
          indoor: false,
          rating: 4.8,
          reviewCount: 15000,
        },
      ],
    };

    const enriched = await enrichItinerary(
      {
        days: [
          {
            day: 1,
            activities: [
              {
                time: "10:00",
                title: "Explore Dallas Zoo",
                type: "activity",
                slotKind: "morning_activity",
              },
              {
                time: "12:30",
                title: "Picnic lunch near Dallas Zoo",
                type: "meal",
                slotKind: "lunch",
              },
              {
                time: "14:00",
                title: "Explore Perot Museum",
                type: "activity",
                slotKind: "afternoon_activity",
              },
              {
                time: "18:00",
                title: "Dinner at a local spot",
                type: "meal",
                slotKind: "dinner",
              },
            ],
          },
        ],
      },
      plan(),
      { cityOverride: city },
    );

    const zoo = enriched.days[0]!.activities.find((a) => /Dallas Zoo/i.test(a.title) && a.type === "activity");
    // Travel legs are titled after their destination too, so match the stop itself.
    const museum = enriched.days[0]!.activities.find(
      (a) => /Perot/i.test(a.title) && a.type === "activity",
    );
    expect(zoo?.rating).toBe(4.6);
    expect(zoo?.reviewCount).toBe(12345);
    expect(zoo?.placeId).toBe("places/dallas-zoo");
    expect(museum?.rating).toBe(4.7);

    vi.unstubAllGlobals();
  });
});
