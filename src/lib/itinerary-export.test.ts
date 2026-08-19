import { describe, expect, it } from "vitest";
import {
  buildCoverContent,
  formatCompactActivityLines,
  formatCoverDateRange,
  formatFamilyCoverLines,
  formatItineraryPlainText,
  isValidShareEmail,
  itineraryPdfFilename,
} from "@/lib/itinerary-export";
import { Itinerary } from "@/types/itinerary";

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
            time: "10:00",
            endTime: "11:30",
            title: "Explore Louvre",
            type: "activity",
            timeOfDay: "morning",
            notes: "Buy tickets ahead. Bring water.",
            location: { name: "Louvre Museum", lat: 0, lng: 0 },
          },
          {
            time: "12:30",
            endTime: "13:30",
            title: "Lunch near Louvre",
            type: "meal",
            timeOfDay: "afternoon",
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
    ],
  };
}

describe("itinerary export — FAM-50", () => {
  it("formats cover date ranges like July 8 – 14", () => {
    expect(formatCoverDateRange("2026-07-08", "2026-07-14")).toBe("July 8 – 14");
  });

  it("formats family cover lines with kids ages", () => {
    expect(formatFamilyCoverLines({ adults: 2, children: [4, 8] })).toEqual([
      "Family:",
      "2 Adults",
      "Kids: 4 & 8",
    ]);
  });

  it("builds cover content for the PDF first page", () => {
    const cover = buildCoverContent({
      itinerary: sampleItinerary(),
      plan: {
        adults: 2,
        children: [4, 8],
        startDate: "2026-07-08",
        endDate: "2026-07-14",
      },
    });
    expect(cover.destination).toBe("Paris");
    expect(cover.dateRange).toBe("July 8 – 14");
    expect(cover.familyLines).toContain("Kids: 4 & 8");
    expect(cover.generatedBy).toMatch(/FamilyTravely/);
  });

  it("formats compact expanded activity lines for export", () => {
    const { summary, details } = formatCompactActivityLines(
      {
        time: "10:00",
        endTime: "12:00",
        title: "Explore Belmont Park",
        type: "activity",
        timeOfDay: "morning",
        notes: "Half-day at the boardwalk.",
        location: { name: "Belmont Park", lat: 0, lng: 0 },
        rating: 4.6,
        reviewCount: 17936,
        activityCost: 60,
      },
      "$",
      { asciiStar: true },
    );
    expect(summary).toMatch(/10:00a/);
    expect(summary).toContain("Explore Belmont Park");
    expect(summary).toContain("*4.6 (18k)");
    expect(summary).toContain("$60");
    expect(details[0]).toBe("10:00 AM – 12:00 PM");
    expect(details[1]).toMatch(/Maps: https:\/\/www\.google\.com\/maps/);
    expect(details[2]).toContain("Half-day at the boardwalk");
  });

  it("includes day schedule details in the plain-text email body", () => {
    const text = formatItineraryPlainText({
      itinerary: sampleItinerary(),
      plan: {
        adults: 2,
        children: [4, 8],
        startDate: "2026-07-08",
        endDate: "2026-07-14",
      },
    });
    expect(text).toContain("Paris");
    expect(text).toContain("Day 1");
    expect(text).toContain("Explore Louvre");
    expect(text).toMatch(/Maps: https:\/\/www\.google\.com\/maps/);
    expect(text).toMatch(/10:00a/);
    expect(text).toMatch(/10:00 AM – 11:30 AM/);
    expect(text).toMatch(/Food \$40/);
    expect(text).toMatch(/Transport \$20/);
    expect(text).toMatch(/Activities \$50/);
  });

  it("validates share emails and builds a pdf filename", () => {
    expect(isValidShareEmail("a@b.co")).toBe(true);
    expect(isValidShareEmail("nope")).toBe(false);
    expect(itineraryPdfFilename(sampleItinerary())).toBe(
      "familytravely-paris-2026-07-08.pdf",
    );
  });
});
