import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim();

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Places details unavailable" }, { status: 503 });
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=formatted_address,geometry,name,place_id` +
      `&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data.result;
    const lat = result?.geometry?.location?.lat;
    const lng = result?.geometry?.location?.lng;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "No location for place" }, { status: 404 });
    }

    return NextResponse.json({
      placeId: result.place_id ?? placeId,
      address: result.formatted_address ?? result.name ?? "",
      lat,
      lng,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch place details" }, { status: 502 });
  }
}
