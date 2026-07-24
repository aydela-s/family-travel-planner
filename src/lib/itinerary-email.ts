import { BRAND } from "@/config/brand";
import {
  getAccommodationLabel,
  getBudgetStyleLabelPlain,
  getTransportationLabel,
} from "@/lib/format-labels";
import { formatCoverDateRange, formatFamilyCoverLines } from "@/lib/itinerary-export";
import {
  emailLogoUrl,
  feedbackPath,
  linkOrigin,
  sharedTripViewPath,
} from "@/lib/public-urls";
import { Itinerary, ItineraryActivity } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type AffiliateTicketLink = {
  label: string;
  url: string;
};

export type DayPreviewStop = {
  label: string;
  title: string;
};

export type ItineraryEmailModel = {
  destination: string;
  dateRange: string;
  dayCount: number;
  dayCountLabel: string;
  travelers: string;
  transportation: string;
  accommodation: string;
  budget: string;
  dietary: string;
  interests: string;
  day1Title: string;
  day1Stops: DayPreviewStop[];
  moreDaysCount: number;
  moreDaysNote: string | null;
  viewUrl: string;
  feedbackUrl: string;
  /** Hosted PDF link — omit until available. */
  pdfUrl?: string;
  affiliateTickets: AffiliateTicketLink[];
  personalNote?: string;
  logoUrl: string;
  brandName: string;
  tagline: string;
  subject: string;
};

function previewLabel(activity: ItineraryActivity): string {
  if (activity.type === "meal") {
    const t = activity.title.toLowerCase();
    if (t.includes("breakfast")) return "Breakfast";
    if (t.includes("lunch")) return "Lunch";
    if (t.includes("dinner")) return "Dinner";
    return "Meal";
  }
  if (activity.type === "nap") return "Nap";
  if (activity.type === "rest") return "Break";
  return "Activity";
}

/** Highlights for Day 1 — meals + main activities (skip tiny fillers). */
export function buildDay1PreviewStops(day1: Itinerary["days"][0] | undefined): DayPreviewStop[] {
  if (!day1) return [];
  const stops: DayPreviewStop[] = [];
  for (const a of day1.activities) {
    if (a.type === "travel") continue;
    if (a.slotKind === "evening_rest" || a.slotKind === "midday_rest") continue;
    if (a.slotKind === "grocery") continue;
    stops.push({ label: previewLabel(a), title: a.title });
    if (stops.length >= 8) break;
  }
  return stops;
}

/**
 * Optional affiliate tickets for the email.
 * Returns empty until FAM-48 wires real links — section stays hidden.
 */
export function affiliateTicketsForItinerary(_itinerary: Itinerary): AffiliateTicketLink[] {
  return [];
}

export function buildItineraryEmailSubject(destination: string): string {
  const city = destination.trim() || "family";
  return `✈️ Your ${city} family itinerary is ready!`;
}

export function buildItineraryEmailModel(input: {
  itinerary: Itinerary;
  plan?: TripPlan;
  appOrigin: string;
  personalNote?: string;
  pdfUrl?: string;
  shareId?: string;
}): ItineraryEmailModel {
  const { itinerary, plan, appOrigin, personalNote, pdfUrl, shareId } = input;
  const origin = linkOrigin(appOrigin);
  const destination = itinerary.destinationCity || itinerary.destination || "Your trip";
  const start = plan?.startDate ?? itinerary.days[0]?.date ?? "";
  const end = plan?.endDate ?? itinerary.days[itinerary.days.length - 1]?.date ?? start;
  const dayCount = itinerary.days.length;
  const moreDaysCount = Math.max(0, dayCount - 1);

  const familyLines = formatFamilyCoverLines(
    plan ? { adults: plan.adults, children: plan.children } : undefined,
  );
  const travelers =
    familyLines.length > 0
      ? familyLines.filter((l) => l !== "Family:").join(" · ")
      : "—";

  return {
    destination,
    dateRange: formatCoverDateRange(start, end) || itinerary.tripStartFormatted,
    dayCount,
    dayCountLabel: `${dayCount} Day${dayCount !== 1 ? "s" : ""}`,
    travelers,
    transportation: getTransportationLabel(plan?.transportationType ?? ""),
    accommodation: getAccommodationLabel(plan?.accommodationType ?? ""),
    budget: getBudgetStyleLabelPlain(plan?.budgetStyle ?? itinerary.budgetStyle ?? ""),
    dietary: plan?.dietaryRestrictions?.trim() || "Nothing specific",
    interests:
      plan?.interests && plan.interests.length > 0 ? plan.interests.join(", ") : "—",
    day1Title: "Day 1",
    day1Stops: buildDay1PreviewStops(itinerary.days[0]),
    moreDaysCount,
    moreDaysNote:
      moreDaysCount > 0
        ? `…and ${moreDaysCount} more day${moreDaysCount !== 1 ? "s" : ""} planned.`
        : null,
    viewUrl: shareId
      ? `${origin}${sharedTripViewPath(shareId)}`
      : `${origin}/plan`,
    feedbackUrl: `${origin}${feedbackPath()}`,
    pdfUrl,
    affiliateTickets: affiliateTicketsForItinerary(itinerary),
    personalNote: personalNote?.trim() || undefined,
    logoUrl: emailLogoUrl(origin),
    brandName: BRAND.name,
    tagline: BRAND.taglineSentence,
    subject: buildItineraryEmailSubject(destination),
  };
}
