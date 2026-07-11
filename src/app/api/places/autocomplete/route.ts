import { NextResponse } from "next/server";
import { getLocalPlaceSuggestions } from "@/lib/places-autocomplete";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${apiKey}`;
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
    } catch {
      // fall through to local
    }
  }

  return NextResponse.json({
    suggestions: getLocalPlaceSuggestions(query),
  });
}
