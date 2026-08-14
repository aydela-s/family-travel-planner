import { describe, expect, it } from "vitest";
import { applyFallbackDisplayTitles, fallbackDisplayTitle } from "@/lib/ai/display-titles";
import { applyPolishPayload } from "@/lib/ai/polish-itinerary";
import { parsePolishPayload, sanitizeDisplayTitle, sanitizeTip } from "@/lib/ai/polish-schema";
import { applyDailyThemes, buildTripStrategy } from "@/lib/planning-engine/staged";
import { CITY_CONFIGS } from "@/config/city-pricing";
import type { Itinerary } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

function sdPlan(): TripPlan {
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
    dietaryRestrictions: "",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Beaches & Waterfronts", "Interactive Museums"],
  };
}

function sampleItinerary(): Itinerary {
  return {
    destination: "San Diego",
    destinationCity: "San Diego",
    tripStartFormatted: "September 15, 2026 – September 19, 2026",
    currency: "USD",
    currencySymbol: "$",
    pricingDisclaimer: "Estimates only.",
    budgetStyle: "balanced",
    days: [
      {
        day: 1,
        date: "2026-09-15",
        weekday: "Tuesday",
        formattedDate: "Tuesday, September 15, 2026",
        activities: [
          {
            time: "10:00",
            title: "Explore Waterfront Park Playground",
            type: "activity",
            timeOfDay: "morning",
          },
          {
            time: "12:30",
            title: "Picnic lunch near Waterfront Park Playground",
            type: "meal",
            timeOfDay: "afternoon",
            notes: "Keep this existing note.",
          },
        ],
        costBreakdown: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
        accommodationTips: [],
        costs: { food: 0, transport: 0, activities: 0, total: 0, currency: "USD" },
        metrics: {},
        routeSegments: [],
        mapUrl: null,
      },
    ],
  };
}

describe("fallback display titles", () => {
  it("maps internal theme ids to vacation-style titles, not catalog labels", () => {
    expect(fallbackDisplayTitle("beach")).toBe("Beach Day");
    expect(fallbackDisplayTitle("interactive")).toBe("Hands-On Discovery Day");
    expect(fallbackDisplayTitle("arrival")).toBe("Easy Arrival Day");
    expect(fallbackDisplayTitle("not-a-theme")).toBeUndefined();
  });

  it("stamps titles from the blueprint without changing activity copy", () => {
    const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
    const plan = sdPlan();
    const blueprint = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
    const itinerary = sampleItinerary();
    const stamped = applyFallbackDisplayTitles(itinerary, blueprint);

    expect(stamped.days[0]!.displayTitle).toBe(
      fallbackDisplayTitle(blueprint.days[0]!.theme.id),
    );
    expect(stamped.days[0]!.activities[0]!.title).toBe(
      itinerary.days[0]!.activities[0]!.title,
    );
  });
});

describe("polish schema", () => {
  it("accepts a constrained title and tip", () => {
    expect(sanitizeDisplayTitle("Ocean Adventure Day")).toBe("Ocean Adventure Day");
    expect(sanitizeTip("Bring layers — the cove is breezy.")).toBe(
      "Bring layers — the cove is breezy.",
    );
  });

  it("rejects titles that look like activity or restaurant copy", () => {
    expect(sanitizeDisplayTitle("Explore La Jolla Cove")).toBeNull();
    expect(sanitizeDisplayTitle("Lunch at Mr. Charlie's")).toBeNull();
    expect(sanitizeDisplayTitle("Day")).toBeNull();
    expect(sanitizeDisplayTitle("https://evil.example")).toBeNull();
  });

  it("parses fenced JSON and drops invalid days", () => {
    const payload = parsePolishPayload(`\`\`\`json
{"days":[
  {"day":1,"displayTitle":"Ocean Adventure Day","tips":{"1|10:00|Explore Waterfront Park Playground":"Pack sunscreen."}},
  {"day":"nope","displayTitle":"Bad"}
]}
\`\`\``);
    expect(payload?.days).toHaveLength(1);
    expect(payload?.days[0]!.displayTitle).toBe("Ocean Adventure Day");
    expect(payload?.days[0]!.tips?.["1|10:00|Explore Waterfront Park Playground"]).toBe(
      "Pack sunscreen.",
    );
  });
});

describe("applyPolishPayload", () => {
  it("overlays titles and empty-note tips without rewriting stops or existing notes", () => {
    const itinerary = sampleItinerary();
    const originalTitle = itinerary.days[0]!.activities[0]!.title;
    const originalMealNotes = itinerary.days[0]!.activities[1]!.notes;

    const polished = applyPolishPayload(
      itinerary,
      parsePolishPayload(
        JSON.stringify({
          days: [
            {
              day: 1,
              displayTitle: "Ocean Adventure Day",
              tips: {
                "1|10:00|Explore Waterfront Park Playground": "Go early for open swings.",
                "1|12:30|Picnic lunch near Waterfront Park Playground": "Should not replace notes.",
              },
            },
          ],
        }),
      ),
    );

    expect(polished.days[0]!.displayTitle).toBe("Ocean Adventure Day");
    expect(polished.days[0]!.activities[0]!.title).toBe(originalTitle);
    expect(polished.days[0]!.activities[0]!.notes).toBe("Go early for open swings.");
    expect(polished.days[0]!.activities[1]!.notes).toBe(originalMealNotes);
    expect(polished.days[0]!.activities).toHaveLength(itinerary.days[0]!.activities.length);
  });
});
