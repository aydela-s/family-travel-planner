import { AccommodationType, BudgetStyle, TransportationType } from "@/types/trip-plan";

/**
 * Single source of truth for user-facing labels of these enums.
 * Wizard steps and the Summary review step must both read from here so
 * their wording can never drift apart again (see FAM-17).
 */
export const TRANSPORTATION_LABELS: Record<TransportationType, string> = {
  walking: "Walking",
  "car-rental": "Car rental",
  taxis: "Taxis",
  "public-transportation": "Public transit",
};

export function getTransportationLabel(type: TransportationType | ""): string {
  return type ? TRANSPORTATION_LABELS[type] : "—";
}

export const ACCOMMODATION_LABELS: Record<AccommodationType, string> = {
  hotel_breakfast_included: "Hotel — breakfast included",
  hotel_no_breakfast: "Hotel — no breakfast",
  airbnb_with_kitchen: "Rental with kitchen",
  airbnb_no_kitchen: "Rental without kitchen",
  staying_with_family_or_friends: "With family or friends",
  "": "Not specified",
};

export function getAccommodationLabel(type: AccommodationType | ""): string {
  return ACCOMMODATION_LABELS[type] ?? "Not specified";
}

export const BUDGET_STYLE_LABELS: Record<BudgetStyle, { emoji: string; label: string }> = {
  save: { emoji: "💰", label: "Save Money" },
  balanced: { emoji: "⚖️", label: "Balanced" },
  splurge: { emoji: "✨", label: "Treat Ourselves" },
};

export function getBudgetStyleLabel(style: BudgetStyle | ""): string {
  if (!style) return "—";
  const meta = BUDGET_STYLE_LABELS[style];
  return `${meta.emoji} ${meta.label}`;
}

export function getBudgetStyleLabelPlain(style: BudgetStyle | ""): string {
  if (!style) return "—";
  return BUDGET_STYLE_LABELS[style].label;
}
