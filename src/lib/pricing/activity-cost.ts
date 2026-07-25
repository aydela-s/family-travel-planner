import { Landmark, TicketTier } from "@/config/city-pricing";

/** Fallback age multipliers when a landmark has no curated ticketTiers. */
export function childTicketMultiplier(age: number): number {
  if (age <= 2) return 0;
  if (age <= 6) return 0.5;
  if (age <= 12) return 0.7;
  return 1;
}

/**
 * Price for one person of the given age using curated tiers.
 * Tiers should be ordered youngest → adult (`maxAgeInclusive: null` last).
 */
export function ticketPriceForAge(
  tiers: TicketTier[] | undefined,
  adultPrice: number,
  age: number | "adult",
): number {
  if (!tiers || tiers.length === 0) {
    if (age === "adult") return adultPrice;
    return Math.round(adultPrice * childTicketMultiplier(age) * 100) / 100;
  }

  if (age === "adult") {
    const adultTier = tiers.filter((t) => t.maxAgeInclusive === null);
    return adultTier[adultTier.length - 1]?.price ?? adultPrice;
  }

  for (const tier of tiers) {
    if (tier.maxAgeInclusive === null) continue;
    if (age <= tier.maxAgeInclusive) return tier.price;
  }
  const adultTier = tiers.filter((t) => t.maxAgeInclusive === null);
  return adultTier[adultTier.length - 1]?.price ?? adultPrice;
}

export function familyActivityCost(
  adultPriceOrLandmark: number | Pick<Landmark, "adultPrice" | "ticketTiers">,
  adults: number,
  children: number[],
): number {
  const adultPrice =
    typeof adultPriceOrLandmark === "number"
      ? adultPriceOrLandmark
      : adultPriceOrLandmark.adultPrice;
  const tiers =
    typeof adultPriceOrLandmark === "number" ? undefined : adultPriceOrLandmark.ticketTiers;

  let total = adults * ticketPriceForAge(tiers, adultPrice, "adult");
  for (const age of children) {
    total += ticketPriceForAge(tiers, adultPrice, age);
  }
  return Math.round(total * 100) / 100;
}
