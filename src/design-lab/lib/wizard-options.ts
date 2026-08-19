import { activityInterestOptions, dietaryQuickPicks } from "@/components/plan-wizard/shared";
import { ACCOMMODATION_LABELS, BUDGET_STYLE_LABELS, TRANSPORTATION_LABELS } from "@/lib/format-labels";
import { NAP_TIME_OPTIONS } from "@/lib/planning-engine/nap-options";
import type { AccommodationType, BudgetStyle, TransportationType, TravelStyle } from "@/types/trip-plan";

export const LAB_WIZARD_SECTIONS = [
  { id: "where", title: "Where & when", prompt: "Where are you going, and which days?" },
  { id: "who", title: "Who’s coming", prompt: "Adults, kids, and ages — this changes naps and pace." },
  { id: "stay", title: "Stay & getting around", prompt: "Where you’ll sleep and how you’ll move between stops." },
  { id: "pace", title: "Pace & spend", prompt: "How full each day should feel, and how you like to spend." },
  { id: "rhythm", title: "Food & naps", prompt: "Dietary needs and rest windows the plan has to honor." },
  { id: "interests", title: "What sounds fun", prompt: "Pick the kinds of days your kids will actually enjoy." },
] as const;

export const STAY_CATEGORIES = [
  { id: "hotel", label: "Hotel", detail: "A booked hotel" },
  { id: "rental", label: "Rental", detail: "Airbnb, Vrbo, or similar" },
  { id: "friends", label: "Family or friends", detail: "Staying in someone’s home" },
  { id: "dont_know", label: "Not booked yet", detail: "We’ll plan from the city center" },
] as const;

export type StayCategoryId = (typeof STAY_CATEGORIES)[number]["id"];

export function stayCategoryFromType(type: AccommodationType | ""): StayCategoryId | "" {
  if (type === "hotel_breakfast_included" || type === "hotel_no_breakfast") return "hotel";
  if (type === "airbnb_with_kitchen" || type === "airbnb_no_kitchen") return "rental";
  if (type === "staying_with_family_or_friends") return "friends";
  if (type === "dont_know_yet") return "dont_know";
  return "";
}

export const STAY_SUB_OPTIONS: Record<"hotel" | "rental", { value: AccommodationType; label: string }[]> = {
  hotel: [
    { value: "hotel_breakfast_included", label: ACCOMMODATION_LABELS.hotel_breakfast_included },
    { value: "hotel_no_breakfast", label: ACCOMMODATION_LABELS.hotel_no_breakfast },
  ],
  rental: [
    { value: "airbnb_with_kitchen", label: ACCOMMODATION_LABELS.airbnb_with_kitchen },
    { value: "airbnb_no_kitchen", label: ACCOMMODATION_LABELS.airbnb_no_kitchen },
  ],
};

export const PACE_OPTIONS: { value: TravelStyle; label: string; detail: string }[] = [
  { value: "relaxed", label: "Relaxed", detail: "One meaningful outing, plenty of downtime" },
  { value: "balanced", label: "Balanced", detail: "A morning plan and an afternoon plan, with rest" },
  { value: "packed", label: "Packed", detail: "More stops, still sequenced for kids" },
];

export const SPEND_OPTIONS: { value: BudgetStyle; label: string; detail: string }[] = (
  ["save", "balanced", "splurge"] as BudgetStyle[]
).map((value) => ({
  value,
  label: BUDGET_STYLE_LABELS[value].label,
  detail:
    value === "save"
      ? "Free and low-cost stops, simpler meals"
      : value === "splurge"
        ? "Ticketed highlights and nicer restaurants"
        : "A mix of paid highlights and easy meals",
}));

export const TRANSIT_OPTIONS: { value: TransportationType; label: string; detail: string }[] = [
  { value: "car-rental", label: TRANSPORTATION_LABELS["car-rental"], detail: "You drive between stops" },
  { value: "taxis", label: TRANSPORTATION_LABELS.taxis, detail: "Rides between stops, no parking hunt" },
  {
    value: "public-transportation",
    label: TRANSPORTATION_LABELS["public-transportation"],
    detail: "Buses and trains where the city supports them",
  },
];

export const INTEREST_OPTIONS = activityInterestOptions.map(({ label }) => label);
export const DIETARY_OPTIONS = dietaryQuickPicks;
export const NAP_TIMES = NAP_TIME_OPTIONS;
export const JOURNAL_CHAPTERS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
] as const;
