import { CITY_CONFIGS } from "@/config/city-pricing";
import { POPULAR_CITIES, type PopularCity } from "@/lib/places-autocomplete";

export type DestinationBias = {
  /** Short city name used to enrich stay queries (e.g. "Dallas"). */
  cityName: string;
  country?: string;
  lat?: number;
  lng?: number;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchPopularCity(destination: string): PopularCity | null {
  const normalized = normalize(destination);
  if (!normalized) return null;

  // Prefer name / alias hits over country-only matches.
  for (const city of POPULAR_CITIES) {
    const needles = [city.name, ...(city.aliases ?? [])].map(normalize);
    if (needles.some((n) => n && normalized.includes(n))) {
      return city;
    }
  }
  return null;
}

/**
 * Resolve location bias for stay autocomplete from the wizard destination.
 * Prefers popular/pricing city coords so "Dallas" stays bias Texas-area.
 */
export function resolveDestinationBias(destination: string): DestinationBias {
  const trimmed = destination.trim();
  const cityName = trimmed.split(",")[0]?.trim() || trimmed;

  const popular = matchPopularCity(trimmed);
  if (popular && typeof popular.lat === "number" && typeof popular.lng === "number") {
    return {
      cityName: popular.name,
      country: popular.country,
      lat: popular.lat,
      lng: popular.lng,
    };
  }

  // Pricing cities always have coords even if not in the popular extras list.
  for (const city of CITY_CONFIGS) {
    const n = normalize(trimmed);
    if (n.includes(normalize(city.name)) || city.aliases.some((a) => n.includes(a))) {
      return {
        cityName: city.name,
        country: city.country,
        lat: city.lat,
        lng: city.lng,
      };
    }
  }

  if (popular) {
    return { cityName: popular.name, country: popular.country };
  }

  return { cityName };
}

/**
 * Instant coords for a destination pick (local catalog / popular bias).
 * Avoids waiting on Place Details for well-known cities like Dallas.
 */
export function coordsForDestinationPick(
  label: string,
  placeId?: string,
): { lat: number; lng: number } | null {
  if (placeId) {
    const byId = POPULAR_CITIES.find((c) => c.id === placeId);
    if (
      byId &&
      typeof byId.lat === "number" &&
      typeof byId.lng === "number" &&
      Number.isFinite(byId.lat) &&
      Number.isFinite(byId.lng)
    ) {
      return { lat: byId.lat, lng: byId.lng };
    }
  }

  const bias = resolveDestinationBias(label);
  if (
    typeof bias.lat === "number" &&
    typeof bias.lng === "number" &&
    Number.isFinite(bias.lat) &&
    Number.isFinite(bias.lng)
  ) {
    return { lat: bias.lat, lng: bias.lng };
  }
  return null;
}

/** Soft-rank stay suggestions that mention the destination city first. */
export function rankStaySuggestionsByDestination<T extends { label: string }>(
  suggestions: T[],
  cityName: string,
): T[] {
  const needle = cityName.trim().toLowerCase();
  if (!needle || suggestions.length < 2) return suggestions;

  return [...suggestions].sort((a, b) => {
    const aHit = a.label.toLowerCase().includes(needle) ? 0 : 1;
    const bHit = b.label.toLowerCase().includes(needle) ? 0 : 1;
    return aHit - bHit;
  });
}
