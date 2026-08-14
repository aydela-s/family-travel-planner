import { describe, expect, it } from "vitest";
import {
  affiliateTicketsForItinerary,
  buildDay1PreviewStops,
  buildItineraryEmailModel,
  buildItineraryEmailSubject,
} from "@/lib/itinerary-email";
import { Itinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

function sampleItinerary(): Itinerary {
  return {
    destination: "Paris, France",
    destinationCity: "Paris",
    tripStartFormatted: "July 8, 2026 – July 14, 2026",
    currency: "USD",
    currencySymbol: "$",
    pricingDisclaimer: "Estimates only.",
    budgetStyle: "balanced",
    days: [
      {
        day: 1,
        date: "2026-07-08",
        weekday: "Wednesday",
        formattedDate: "Wednesday, July 8, 2026",
        activities: [
          {
            time: "08:00",
            endTime: "08:45",
            title: "Breakfast near Louvre",
            type: "meal",
            timeOfDay: "morning",
            slotKind: "breakfast",
          },
          {
            time: "10:00",
            endTime: "12:00",
            title: "Explore Louvre Museum",
            type: "activity",
            timeOfDay: "morning",
            slotKind: "morning_activity",
          },
          {
            time: "12:30",
            endTime: "13:30",
            title: "Picnic lunch near Louvre",
            type: "meal",
            timeOfDay: "afternoon",
            slotKind: "lunch",
          },
          {
            time: "15:30",
            endTime: "16:45",
            title: "Family time at Tuileries Garden",
            type: "activity",
            timeOfDay: "afternoon",
            slotKind: "afternoon_activity",
          },
          {
            time: "19:00",
            endTime: "20:15",
            title: "Dinner at Le Petit Zinc",
            type: "meal",
            timeOfDay: "evening",
            slotKind: "dinner",
          },
        ],
        costBreakdown: {
          food: 40,
          transport: 20,
          activities: 50,
          total: 110,
          currency: "USD",
        },
        accommodationTips: [],
        costs: {
          food: 40,
          transport: 20,
          activities: 50,
          total: 110,
          currency: "USD",
        },
        metrics: {},
        routeSegments: [],
        mapUrl: null,
      },
      {
        day: 2,
        date: "2026-07-09",
        weekday: "Thursday",
        formattedDate: "Thursday, July 9, 2026",
        activities: [],
        costBreakdown: {
          food: 40,
          transport: 20,
          activities: 50,
          total: 110,
          currency: "USD",
        },
        accommodationTips: [],
        costs: {
          food: 40,
          transport: 20,
          activities: 50,
          total: 110,
          currency: "USD",
        },
        metrics: {},
        routeSegments: [],
        mapUrl: null,
      },
    ],
  };
}

function samplePlan(): TripPlan {
  return {
    destination: "Paris",
    startDate: "2026-07-08",
    endDate: "2026-07-14",
    adults: 2,
    children: [4, 8],
    travelStyle: "balanced",
    walkingLimit: "medium",
    transportationType: "public-transportation",
    accommodationType: "airbnb_with_kitchen",
    dietaryRestrictions: "Vegetarian",
    naps: [],
    budgetStyle: "balanced",
    interests: ["Parks & Gardens", "Museums & Art"],
  };
}

describe("itinerary email model — FAM-50", () => {
  it("builds a branded subject line", () => {
    expect(buildItineraryEmailSubject("Paris")).toBe(
      "✈️ Your Paris family itinerary is ready!",
    );
  });

  it("previews Day 1 meal and activity highlights", () => {
    const stops = buildDay1PreviewStops(sampleItinerary().days[0]);
    expect(stops.map((s) => s.label)).toEqual([
      "Breakfast",
      "Activity",
      "Lunch",
      "Activity",
      "Dinner",
    ]);
    expect(stops.some((s) => /Louvre/i.test(s.title))).toBe(true);
  });

  it("hides affiliate tickets until links exist", () => {
    expect(affiliateTicketsForItinerary(sampleItinerary())).toEqual([]);
  });

  it("assembles summary fields and CTA urls from the trip", () => {
    const model = buildItineraryEmailModel({
      itinerary: sampleItinerary(),
      plan: samplePlan(),
      appOrigin: "http://localhost:3000",
      personalNote: "Can't wait!",
    });
    expect(model.destination).toBe("Paris");
    expect(model.dateRange).toBe("July 8–14");
    expect(model.dayCountLabel).toBe("2 Days");
    expect(model.moreDaysNote).toBe("…and 1 more day planned.");
    expect(model.travelers).toContain("2 Adults");
    expect(model.transportation).toBe("Public transit");
    expect(model.accommodation).toMatch(/kitchen/i);
    expect(model.dietary).toBe("Vegetarian");
    expect(model.interests).toContain("Museums");
    expect(model.viewUrl).toBe("http://localhost:3000/plan");
    expect(model.feedbackUrl).toBe("http://localhost:3000/feedback");
    expect(model.pdfUrl).toBeUndefined();
    expect(model.subject).toContain("Paris");
    expect(model.day1Title).toBe("Day 1");
    // Email clients can't fetch localhost — logo uses a public asset host.
    expect(model.logoUrl).toMatch(/^https:\/\/.+\/tripnestly-logo\.png$/);
    expect(model.logoUrl).not.toMatch(/localhost/);
  });

  it("uses the polished display title in the Day 1 preview heading", () => {
    const itinerary = sampleItinerary();
    itinerary.days[0]!.displayTitle = "Easy Arrival Day";
    const model = buildItineraryEmailModel({
      itinerary,
      plan: samplePlan(),
      appOrigin: "http://localhost:3000",
    });
    expect(model.day1Title).toBe("Day 1 · Easy Arrival Day");
  });

  it("deep-links View Full Itinerary to the editable shared trip", () => {
    const model = buildItineraryEmailModel({
      itinerary: sampleItinerary(),
      plan: samplePlan(),
      appOrigin: "http://localhost:3000",
      shareId: "11111111-2222-3333-4444-555555555555",
    });
    expect(model.viewUrl).toBe(
      "http://localhost:3000/plan?share=11111111-2222-3333-4444-555555555555",
    );
    expect(model.feedbackUrl).toBe("http://localhost:3000/feedback");
  });
});
