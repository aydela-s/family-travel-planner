/**
 * Places API (New) Autocomplete + Details helpers.
 * Legacy Place Autocomplete/Details need GOOGLE_MAPS_API_KEY with Places (legacy);
 * this project’s key is Places API (New) only — use these endpoints instead.
 */

import { resolvePlacesApiKey } from "@/lib/maps/get-top-activities";
import type { PlaceSuggestion } from "@/lib/places-autocomplete";

export type PlacesNewAutocompleteOptions = {
  input: string;
  /** Default `(cities)` for destination; omit / empty for stay/address search. */
  includedPrimaryTypes?: string[];
  locationBias?: { lat: number; lng: number; radiusMeters?: number };
  includedRegionCodes?: string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

type PlacePrediction = {
  place?: string;
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: PlacePrediction;
  }>;
  error?: { message?: string; status?: string };
};

function predictionLabel(pred: PlacePrediction): string {
  const text = pred.text?.text?.trim();
  if (text) return text;
  const main = pred.structuredFormat?.mainText?.text?.trim() ?? "";
  const secondary = pred.structuredFormat?.secondaryText?.text?.trim() ?? "";
  return [main, secondary].filter(Boolean).join(", ");
}

/** Normalize `places/ChIJ…` or bare `ChIJ…` to a bare place id for Place Details. */
export function barePlaceId(placeIdOrName: string): string {
  const trimmed = placeIdOrName.trim();
  return trimmed.startsWith("places/") ? trimmed.slice("places/".length) : trimmed;
}

export async function autocompletePlacesNew(
  options: PlacesNewAutocompleteOptions,
): Promise<PlaceSuggestion[]> {
  const apiKey = options.apiKey ?? resolvePlacesApiKey();
  if (!apiKey) return [];

  const body: Record<string, unknown> = {
    input: options.input,
  };
  if (options.includedPrimaryTypes && options.includedPrimaryTypes.length > 0) {
    body.includedPrimaryTypes = options.includedPrimaryTypes;
  }
  if (options.includedRegionCodes && options.includedRegionCodes.length > 0) {
    body.includedRegionCodes = options.includedRegionCodes;
  }
  if (
    options.locationBias &&
    Number.isFinite(options.locationBias.lat) &&
    Number.isFinite(options.locationBias.lng)
  ) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.lat,
          longitude: options.locationBias.lng,
        },
        radius: options.locationBias.radiusMeters ?? 50_000,
      },
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("Places Autocomplete (New) failure:", {
      status: res.status,
      body: errText.slice(0, 300),
      input: options.input,
    });
    return [];
  }

  const data = (await res.json()) as AutocompleteResponse;
  const out: PlaceSuggestion[] = [];
  for (const suggestion of data.suggestions ?? []) {
    const pred = suggestion.placePrediction;
    if (!pred) continue;
    const placeId = barePlaceId(pred.placeId || pred.place || "");
    const label = predictionLabel(pred);
    if (!placeId || !label) continue;
    out.push({ label, placeId });
  }
  return out;
}

export type PlaceDetailsNew = {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
};

export async function fetchPlaceDetailsNew(
  placeId: string,
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<PlaceDetailsNew | null> {
  const apiKey = options.apiKey ?? resolvePlacesApiKey();
  if (!apiKey) return null;

  const id = barePlaceId(placeId);
  if (!id) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location,displayName",
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("Places Details (New) failure:", {
      status: res.status,
      body: errText.slice(0, 300),
      placeId: id,
    });
    return null;
  }

  const data = (await res.json()) as {
    id?: string;
    formattedAddress?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  };

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return {
    placeId: barePlaceId(data.id || id),
    address: data.formattedAddress?.trim() || data.displayName?.text?.trim() || "",
    lat,
    lng,
  };
}
