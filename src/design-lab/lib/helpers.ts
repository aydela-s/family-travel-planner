import type { Itinerary, ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";
import { formatAdultsLabel, formatKidsWithAges, formatTripDateRange } from "@/lib/format";
import {
  getAccommodationLabel,
  getBudgetStyleLabelPlain,
  getTransportationLabel,
  getTravelStyleLabel,
} from "@/lib/format-labels";

export function moneyWhole(amount: number, symbol = "$"): string {
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

export function tripTotals(itinerary: Itinerary) {
  return itinerary.days.reduce(
    (acc, day) => ({
      food: acc.food + day.costBreakdown.food,
      transport: acc.transport + day.costBreakdown.transport,
      activities: acc.activities + day.costBreakdown.activities,
      total: acc.total + day.costBreakdown.total,
    }),
    { food: 0, transport: 0, activities: 0, total: 0 },
  );
}

export function partyLine(plan: TripPlan): string {
  const adults = formatAdultsLabel(plan.adults);
  const kids = formatKidsWithAges(plan.children);
  return kids ? `${adults} · ${kids}` : adults;
}

export function planFacts(plan: TripPlan) {
  return {
    when: plan.startDate && plan.endDate ? formatTripDateRange(plan.startDate, plan.endDate) : "Dates TBD",
    party: partyLine(plan),
    stay: getAccommodationLabel(plan.accommodationType),
    stayAddress: plan.stayAddress?.trim() || "Stay not set",
    transit: getTransportationLabel(plan.transportationType),
    pace: getTravelStyleLabel(plan.travelStyle),
    budget: getBudgetStyleLabelPlain(plan.budgetStyle),
    naps:
      plan.naps == null
        ? "Not set"
        : plan.naps.length === 0
          ? "No naps"
          : plan.naps.map((nap) => `${nap.startTime}–${nap.endTime}`).join(", "),
    interests: plan.interests,
    dietary: plan.dietaryRestrictions.trim() || "None noted",
  };
}

export function isTimedStop(activity: ItineraryActivity): boolean {
  return activity.type !== "travel";
}

export function visibleStops(day: ItineraryDay): ItineraryActivity[] {
  return day.activities.filter((activity) => activity.type !== "travel");
}

export function mapLocations(day: ItineraryDay) {
  return day.activities
    .filter((activity) => activity.location && activity.type !== "nap" && activity.type !== "rest")
    .map((activity) => activity.location!)
    .filter((location, index, list) => list.findIndex((item) => item.name === location.name) === index);
}

export function formatClock(time: string): string {
  if (/[ap]m/i.test(time)) return time.replace(/\s+/g, " ");
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatClockCompact(time: string): string {
  const full = formatClock(time);
  return full.replace(" AM", "a").replace(" PM", "p").replace(":00", "");
}

export function activityKindLabel(type: ItineraryActivity["type"]): string {
  switch (type) {
    case "meal":
      return "Meal";
    case "nap":
      return "Nap";
    case "rest":
      return "Rest";
    case "travel":
      return "Travel";
    default:
      return "Out";
  }
}

export function dayHeadline(day: ItineraryDay): string {
  return day.displayTitle || visibleStops(day).find((item) => item.type === "activity")?.title || `Day ${day.day}`;
}
