import { NextResponse } from "next/server";
import { CITY_CONFIGS } from "@/config/city-pricing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const normalized = query.toLowerCase();

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

  const local = CITY_CONFIGS.flatMap((c) => [
    { label: `${c.name}, ${c.country === "US" ? "USA" : c.country}`, placeId: c.id },
    ...c.aliases.map((a) => ({
      label: a.replace(/\b\w/g, (ch) => ch.toUpperCase()),
      placeId: c.id,
    })),
  ]).filter((s) => s.label.toLowerCase().includes(normalized));

  const unique = Array.from(new Map(local.map((s) => [s.label, s])).values()).slice(0, 8);
  return NextResponse.json({ suggestions: unique });
}
