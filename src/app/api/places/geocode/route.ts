import { NextResponse } from "next/server";
import { geocodeStay } from "@/lib/places-geocode";

/** Resolve a free-text hotel/address using the known destination city as bias. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const city = searchParams.get("city")?.trim() || "";
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : NaN;
  const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : NaN;

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng city bias required" }, { status: 400 });
  }

  const resolved = await geocodeStay({ query, city, lat, lng });
  return NextResponse.json(resolved);
}
