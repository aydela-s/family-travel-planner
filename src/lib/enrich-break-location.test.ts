import { describe, expect, it, vi } from "vitest";
import { CITY_CONFIGS } from "@/config/city-pricing";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import { extractLandmarkFromTitle } from "@/lib/schedule/landmark-hours";
import { TripPlan } from "@/types/trip-plan";

function plan(): TripPlan {
  return {
    destination: "San Diego",
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    adults: 2,
    children: [8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "car-rental",
    accommodationType: "airbnb_with_kitchen",
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "save",
    interests: [],
  };
}

describe("enrich unpaid break locations from title", () => {
  it("extracts Break at Belmont Park from the title", () => {
    expect(extractLandmarkFromTitle("Break at Belmont Park")).toBe("Belmont Park");
  });

  it("pins Break at Belmont Park to Belmont, not the prior morning landmark", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    const sanDiego = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const kate = sanDiego.landmarks.find((l) => l.name === "Kate Sessions Park")!;
    const belmont = sanDiego.landmarks.find((l) => l.name === "Belmont Park")!;

    const enriched = await enrichItinerary(
      {
        days: [
          {
            day: 1,
            activities: [
              {
                time: "08:30",
                title: "Explore Kate Sessions Park",
                type: "activity",
                slotKind: "morning_activity",
              },
              {
                time: "12:00",
                title: "Picnic lunch near Belmont Park",
                type: "meal",
                slotKind: "lunch",
              },
              {
                time: "13:30",
                title: "Break at Belmont Park",
                type: "activity",
                slotKind: "midday_rest",
              },
            ],
          },
        ],
      },
      plan(),
      { cityOverride: sanDiego },
    );

    const day = enriched.days[0]!;
    const morning = day.activities.find((a) => /Kate Sessions/i.test(a.title))!;
    const brk = day.activities.find((a) => /Break at Belmont/i.test(a.title))!;

    expect(morning.location?.name).toBe(kate.name);
    expect(brk.location?.name).toBe(belmont.name);
    expect(brk.location?.lat).toBe(belmont.lat);
    expect(brk.location?.lng).toBe(belmont.lng);
    expect(brk.placeId).toBe(belmont.placeId);
  });
});
