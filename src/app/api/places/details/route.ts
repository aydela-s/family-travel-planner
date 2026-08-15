import { NextResponse } from "next/server";
import { fetchPlaceDetailsNew } from "@/lib/maps/places-autocomplete-new";
import { resolvePlacesApiKey } from "@/lib/maps/get-top-activities";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim();

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const apiKey = resolvePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Places details unavailable" }, { status: 503 });
  }

  try {
    const details = await fetchPlaceDetailsNew(placeId, { apiKey });
    if (!details) {
      return NextResponse.json({ error: "No location for place" }, { status: 404 });
    }

    return NextResponse.json({
      placeId: details.placeId,
      address: details.address,
      lat: details.lat,
      lng: details.lng,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch place details" }, { status: 502 });
  }
}
