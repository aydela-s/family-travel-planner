import { CITY_CONFIGS } from "@/config/city-pricing";

export type PlaceSuggestion = {
  label: string;
  placeId: string;
};

/** Full country names, except well-known abbreviations (USA, UK). */
const COUNTRY_LABELS: Record<string, string> = {
  US: "USA",
  GB: "UK",
  FR: "France",
  IL: "Israel",
  JP: "Japan",
};

export function getCountryLabel(countryCode: string): string {
  return COUNTRY_LABELS[countryCode] ?? countryCode;
}

/**
 * Local fallback suggestions when Google Places is unavailable.
 * One canonical row per city — aliases are used for matching only (FAM-11).
 */
export function getLocalPlaceSuggestions(
  query: string,
  limit = 8,
): PlaceSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return CITY_CONFIGS.filter((c) => {
    const countryLabel = getCountryLabel(c.country);
    const haystack = [c.name, c.country, countryLabel, ...c.aliases]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  })
    .map((c) => ({
      label: `${c.name}, ${getCountryLabel(c.country)}`,
      placeId: c.id,
    }))
    .slice(0, limit);
}
