import { NextResponse } from "next/server";
import {
  rankStaySuggestionsByDestination,
  resolveDestinationBias,
} from "@/lib/destination-bias";
import { enrichQuery } from "@/lib/places-geocode";
import {
  getLocalPlaceSuggestions,
  mergePlaceSuggestions,
  shouldLogGooglePlacesFailure,
  type PlaceSuggestion,
} from "@/lib/places-autocomplete";

type GooglePrediction = { description: string; place_id: string };

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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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

  let googleSuggestions: PlaceSuggestion[] = [];

  if (apiKey) {
    try {
      const input =
        isAddress && bias?.cityName ? enrichQuery(query, bias.cityName) : query;
      const typesParam = isAddress ? "" : `&types=${encodeURIComponent("(cities)")}`;
      let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        typesParam +
        `&key=${apiKey}`;

      if (typeof lat === "number" && !Number.isNaN(lat) && typeof lng === "number" && !Number.isNaN(lng)) {
        url +=
          `&location=${encodeURIComponent(`${lat},${lng}`)}` +
          `&radius=${STAY_BIAS_RADIUS_M}`;
      }

      if (isAddress && bias?.country) {
        url += `&components=${encodeURIComponent(`country:${bias.country}`)}`;
      }

      const res = await fetch(url);
      const data = (await res.json()) as {
        status?: string;
        error_message?: string;
        predictions?: GooglePrediction[];
      };

      if (shouldLogGooglePlacesFailure(data.status)) {
        console.warn("Google Places autocomplete failure:", {
          status: data.status,
          error_message: data.error_message,
          query: input,
          mode,
        });
      }

      googleSuggestions = (data.predictions ?? []).map((p) => ({
        label: p.description,
        placeId: p.place_id,
      }));

      if (isAddress && bias?.cityName) {
        googleSuggestions = rankStaySuggestionsByDestination(
          googleSuggestions,
          bias.cityName,
        );
      }
    } catch (err) {
      console.warn("Google Places autocomplete request failed:", err);
      if (isAddress) {
        return NextResponse.json({ suggestions: [] });
      }
    }
  }

  if (isAddress) {
    return NextResponse.json({ suggestions: googleSuggestions });
  }

  // Cities mode: always merge local catalog so popular cities (e.g. Dallas) still appear
  // when Google is empty, denied, or missing a key (FAM-16).
  const local = getLocalPlaceSuggestions(query);
  return NextResponse.json({
    suggestions: mergePlaceSuggestions(googleSuggestions, local),
  });
}
