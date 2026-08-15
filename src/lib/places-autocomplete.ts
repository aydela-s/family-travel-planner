import { CITY_CONFIGS } from "@/config/city-pricing";

export type PlaceSuggestion = {
  label: string;
  placeId: string;
};

/** Lightweight city row for autocomplete fallback (not full pricing configs). */
export type PopularCity = {
  id: string;
  name: string;
  country: string;
  aliases?: string[];
  lat?: number;
  lng?: number;
};

/** Full country names, except well-known abbreviations (USA, UK). */
const COUNTRY_LABELS: Record<string, string> = {
  US: "USA",
  GB: "UK",
  FR: "France",
  IL: "Israel",
  JP: "Japan",
  CA: "Canada",
  AU: "Australia",
  ES: "Spain",
  IT: "Italy",
  DE: "Germany",
  NL: "Netherlands",
  MX: "Mexico",
  BR: "Brazil",
  TH: "Thailand",
  SG: "Singapore",
  AE: "UAE",
  PT: "Portugal",
  IE: "Ireland",
  GR: "Greece",
  NZ: "New Zealand",
};

export function getCountryLabel(countryCode: string): string {
  return COUNTRY_LABELS[countryCode] ?? countryCode;
}

/**
 * Popular destinations for local autocomplete when Google Places is empty/unavailable.
 * Includes pricing cities plus common US / world hubs (FAM-16).
 */
export const POPULAR_CITIES: PopularCity[] = [
  // Pricing configs (canonical) — include coords for stay bias
  ...CITY_CONFIGS.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    aliases: c.aliases,
    lat: c.lat,
    lng: c.lng,
  })),
  // Extra US cities (covers Dallas repro and similar)
  {
    id: "dallas",
    name: "Dallas",
    country: "US",
    aliases: ["dallas tx", "dallas texas"],
    lat: 32.7767,
    lng: -96.797,
  },
  {
    id: "new-york",
    name: "New York",
    country: "US",
    aliases: ["nyc", "new york city", "manhattan"],
    lat: 40.7128,
    lng: -74.006,
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    country: "US",
    aliases: ["la", "l.a."],
    lat: 34.0522,
    lng: -118.2437,
  },
  { id: "chicago", name: "Chicago", country: "US", aliases: ["chi"], lat: 41.8781, lng: -87.6298 },
  { id: "miami", name: "Miami", country: "US", lat: 25.7617, lng: -80.1918 },
  {
    id: "orlando",
    name: "Orlando",
    country: "US",
    aliases: ["orlando fl"],
    lat: 28.5383,
    lng: -81.3792,
  },
  { id: "austin", name: "Austin", country: "US", lat: 30.2672, lng: -97.7431 },
  { id: "houston", name: "Houston", country: "US", lat: 29.7604, lng: -95.3698 },
  { id: "seattle", name: "Seattle", country: "US", lat: 47.6062, lng: -122.3321 },
  { id: "denver", name: "Denver", country: "US", lat: 39.7392, lng: -104.9903 },
  { id: "boston", name: "Boston", country: "US", lat: 42.3601, lng: -71.0589 },
  {
    id: "san-francisco",
    name: "San Francisco",
    country: "US",
    aliases: ["sf", "bay area"],
    lat: 37.7749,
    lng: -122.4194,
  },
  {
    id: "washington-dc",
    name: "Washington",
    country: "US",
    aliases: ["dc", "washington dc"],
    lat: 38.9072,
    lng: -77.0369,
  },
  {
    id: "las-vegas",
    name: "Las Vegas",
    country: "US",
    aliases: ["vegas"],
    lat: 36.1699,
    lng: -115.1398,
  },
  { id: "atlanta", name: "Atlanta", country: "US", lat: 33.749, lng: -84.388 },
  { id: "phoenix", name: "Phoenix", country: "US", lat: 33.4484, lng: -112.074 },
  // World hubs
  { id: "rome", name: "Rome", country: "IT", aliases: ["roma"], lat: 41.9028, lng: 12.4964 },
  { id: "barcelona", name: "Barcelona", country: "ES", lat: 41.3874, lng: 2.1686 },
  { id: "madrid", name: "Madrid", country: "ES", lat: 40.4168, lng: -3.7038 },
  { id: "amsterdam", name: "Amsterdam", country: "NL", lat: 52.3676, lng: 4.9041 },
  { id: "berlin", name: "Berlin", country: "DE", lat: 52.52, lng: 13.405 },
  {
    id: "munich",
    name: "Munich",
    country: "DE",
    aliases: ["munchen", "münchen"],
    lat: 48.1351,
    lng: 11.582,
  },
  { id: "dublin", name: "Dublin", country: "IE", lat: 53.3498, lng: -6.2603 },
  {
    id: "lisbon",
    name: "Lisbon",
    country: "PT",
    aliases: ["lisboa"],
    lat: 38.7223,
    lng: -9.1393,
  },
  { id: "athens", name: "Athens", country: "GR", lat: 37.9838, lng: 23.7275 },
  { id: "toronto", name: "Toronto", country: "CA", lat: 43.6532, lng: -79.3832 },
  { id: "vancouver", name: "Vancouver", country: "CA", lat: 49.2827, lng: -123.1207 },
  {
    id: "montreal",
    name: "Montreal",
    country: "CA",
    aliases: ["montréal"],
    lat: 45.5017,
    lng: -73.5673,
  },
  { id: "sydney", name: "Sydney", country: "AU", lat: -33.8688, lng: 151.2093 },
  { id: "melbourne", name: "Melbourne", country: "AU", lat: -37.8136, lng: 144.9631 },
  { id: "auckland", name: "Auckland", country: "NZ", lat: -36.8509, lng: 174.7645 },
  {
    id: "mexico-city",
    name: "Mexico City",
    country: "MX",
    aliases: ["cdmx"],
    lat: 19.4326,
    lng: -99.1332,
  },
  {
    id: "cancun",
    name: "Cancún",
    country: "MX",
    aliases: ["cancun"],
    lat: 21.1619,
    lng: -86.8515,
  },
  { id: "dubai", name: "Dubai", country: "AE", lat: 25.2048, lng: 55.2708 },
  { id: "singapore", name: "Singapore", country: "SG", lat: 1.3521, lng: 103.8198 },
  { id: "bangkok", name: "Bangkok", country: "TH", lat: 13.7563, lng: 100.5018 },
];

function cityMatchesQuery(city: PopularCity, normalized: string): boolean {
  const name = city.name.toLowerCase();
  const aliases = (city.aliases ?? []).map((a) => a.toLowerCase());
  // Single letter: prefix-only so "d" → Dallas, not every city with an "a".
  if (normalized.length === 1) {
    return name.startsWith(normalized) || aliases.some((a) => a.startsWith(normalized));
  }
  const countryLabel = getCountryLabel(city.country);
  const haystack = [city.name, city.country, countryLabel, ...(city.aliases ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function toSuggestion(city: PopularCity): PlaceSuggestion {
  return {
    label: `${city.name}, ${getCountryLabel(city.country)}`,
    placeId: city.id,
  };
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
  if (normalized.length < 1) return [];

  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];

  for (const city of POPULAR_CITIES) {
    if (!cityMatchesQuery(city, normalized)) continue;
    const suggestion = toSuggestion(city);
    const dedupeKey = suggestion.label.toLowerCase();
    if (seen.has(dedupeKey) || seen.has(suggestion.placeId)) continue;
    seen.add(dedupeKey);
    seen.add(suggestion.placeId);
    out.push(suggestion);
    if (out.length >= limit) break;
  }

  return out;
}

/** Normalize a label for fuzzy duplicate detection across Google + local. */
export function normalizeSuggestionLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First segment before a comma — e.g. "Dallas" from "Dallas, TX, USA". */
export function suggestionCityKey(label: string): string {
  const head = label.split(",")[0] ?? label;
  return normalizeSuggestionLabel(head);
}

/**
 * Prefer Google rows, then append local matches that aren't already covered.
 * City names like "Dallas, TX, USA" vs "Dallas, USA" should not both appear.
 */
export function mergePlaceSuggestions(
  google: PlaceSuggestion[],
  local: PlaceSuggestion[],
  limit = 8,
): PlaceSuggestion[] {
  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();

  function add(s: PlaceSuggestion) {
    const full = normalizeSuggestionLabel(s.label);
    const city = suggestionCityKey(s.label);
    if (seen.has(full) || seen.has(`city:${city}`)) return;
    seen.add(full);
    seen.add(`city:${city}`);
    out.push(s);
  }

  for (const s of google) add(s);
  for (const s of local) {
    if (out.length >= limit) break;
    add(s);
  }

  return out.slice(0, limit);
}

export type GooglePlacesStatus =
  | "OK"
  | "ZERO_RESULTS"
  | "OVER_QUERY_LIMIT"
  | "REQUEST_DENIED"
  | "INVALID_REQUEST"
  | "UNKNOWN_ERROR"
  | string;

export function isGooglePlacesSuccess(status: GooglePlacesStatus | undefined): boolean {
  return status === "OK" || status === "ZERO_RESULTS";
}

export function shouldLogGooglePlacesFailure(status: GooglePlacesStatus | undefined): boolean {
  return Boolean(status) && !isGooglePlacesSuccess(status);
}
