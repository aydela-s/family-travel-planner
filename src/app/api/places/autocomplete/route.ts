import { NextResponse } from "next/server";
import { getLocalPlaceSuggestions } from "@/lib/places-autocomplete";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const mode = searchParams.get("mode")?.trim() || "cities";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const isAddress = mode === "address";

  if (apiKey) {
    try {
      const typesParam = isAddress ? "" : `&types=${encodeURIComponent("(cities)")}`;
      let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(query)}` +
        typesParam +
        `&key=${apiKey}`;

      if (lat && lng) {
        url += `&location=${encodeURIComponent(`${lat},${lng}`)}&radius=50000`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const suggestions = (data.predictions ?? []).map(
        (p: { description: string; place_id: string }) => ({
          label: p.description,
          placeId: p.place_id,
        }),
      );
      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions });
      }
      // Address mode has no local catalog fallback.
      if (isAddress) {
        return NextResponse.json({ suggestions: [] });
      }
    } catch {
      if (isAddress) {
        return NextResponse.json({ suggestions: [] });
      }
      // fall through to local city suggestions
    }
  }

  if (isAddress) {
    return NextResponse.json({ suggestions: [] });
  }

  return NextResponse.json({
    suggestions: getLocalPlaceSuggestions(query),
  });
}
