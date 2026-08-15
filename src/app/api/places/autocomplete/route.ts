import { NextResponse } from "next/server";
import {
  rankStaySuggestionsByDestination,
  resolveDestinationBias,
} from "@/lib/destination-bias";
import { enrichQuery } from "@/lib/places-geocode";
import { autocompletePlacesNew } from "@/lib/maps/places-autocomplete-new";
import { resolvePlacesApiKey } from "@/lib/maps/get-top-activities";
import {
  getLocalPlaceSuggestions,
  mergePlaceSuggestions,
} from "@/lib/places-autocomplete";

/** Metro-scale bias so stay results stay near the destination (e.g. Dallas → N. Texas). */
const STAY_BIAS_RADIUS_M = 50_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const mode = searchParams.get("mode")?.trim() || "cities";
  const destination = searchParams.get("destination")?.trim() || "";
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = resolvePlacesApiKey();
  const isAddress = mode === "address";
  const bias = isAddress ? resolveDestinationBias(destination) : null;

  const lat =
    latParam != null && latParam !== ""
      ? Number(latParam)
      : bias?.lat;
  const lng =
    lngParam != null && lngParam !== ""
      ? Number(lngParam)
      : bias?.lng;

  let googleSuggestions: Awaited<ReturnType<typeof autocompletePlacesNew>> = [];

  if (apiKey) {
    try {
      const hasBiasCoords =
        typeof lat === "number" &&
        !Number.isNaN(lat) &&
        typeof lng === "number" &&
        !Number.isNaN(lng);

      // Stay search: use the typed query + location bias. Appending ", Dallas" to
      // short prefixes ("Ma", "Ho") makes Places return nothing — bias is enough.
      googleSuggestions = await autocompletePlacesNew({
        input: query,
        apiKey,
        includedPrimaryTypes: isAddress ? undefined : ["(cities)"],
        includedRegionCodes:
          isAddress && bias?.country ? [bias.country] : undefined,
        locationBias: hasBiasCoords
          ? { lat: lat as number, lng: lng as number, radiusMeters: STAY_BIAS_RADIUS_M }
          : undefined,
      });

      // If still empty for a clearer hotel/address string, retry with city in the query.
      if (
        isAddress &&
        googleSuggestions.length === 0 &&
        bias?.cityName &&
        query.length >= 3
      ) {
        googleSuggestions = await autocompletePlacesNew({
          input: enrichQuery(query, bias.cityName),
          apiKey,
          includedRegionCodes: bias.country ? [bias.country] : undefined,
          locationBias: hasBiasCoords
            ? { lat: lat as number, lng: lng as number, radiusMeters: STAY_BIAS_RADIUS_M }
            : undefined,
        });
      }

      if (isAddress && bias?.cityName) {
        googleSuggestions = rankStaySuggestionsByDestination(
          googleSuggestions,
          bias.cityName,
        );
      }
    } catch (err) {
      console.warn("Places Autocomplete (New) request failed:", err);
      if (isAddress) {
        return NextResponse.json({ suggestions: [] });
      }
    }
  }

  if (isAddress) {
    return NextResponse.json({ suggestions: googleSuggestions });
  }

  // Cities mode: merge local catalog so popular cities still appear when Google
  // is empty, denied, or missing a key (FAM-16).
  const local = getLocalPlaceSuggestions(query);
  return NextResponse.json({
    suggestions: mergePlaceSuggestions(googleSuggestions, local),
  });
}
