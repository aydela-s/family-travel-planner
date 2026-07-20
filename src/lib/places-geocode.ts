export type GeocodedStay = {
  address: string;
  placeId: string;
  lat: number;
  lng: number;
  source: "places" | "geocode" | "city";
};

function enrichQuery(query: string, city: string): string {
  if (!city) return query;
  if (query.toLowerCase().includes(city.toLowerCase())) return query;
  return `${query}, ${city}`;
}

async function findPlace(
  query: string,
  apiKey: string,
  lat?: number,
  lng?: number,
): Promise<GeocodedStay | null> {
  let url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(query)}` +
    `&inputtype=textquery` +
    `&fields=formatted_address,geometry,name,place_id` +
    `&key=${apiKey}`;
  if (typeof lat === "number" && typeof lng === "number") {
    url += `&locationbias=${encodeURIComponent(`circle:50000@${lat},${lng}`)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const cLat = candidate?.geometry?.location?.lat;
  const cLng = candidate?.geometry?.location?.lng;
  if (typeof cLat !== "number" || typeof cLng !== "number") return null;

  return {
    address: candidate.formatted_address || candidate.name || query,
    placeId: candidate.place_id || "",
    lat: cLat,
    lng: cLng,
    source: "places",
  };
}

async function geocodeAddress(
  query: string,
  apiKey: string,
  lat?: number,
  lng?: number,
): Promise<GeocodedStay | null> {
  let url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(query)}` +
    `&key=${apiKey}`;
  if (typeof lat === "number" && typeof lng === "number") {
    const delta = 0.35;
    url +=
      `&bounds=${encodeURIComponent(
        `${lat - delta},${lng - delta}|${lat + delta},${lng + delta}`,
      )}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  const result = data.results?.[0];
  const gLat = result?.geometry?.location?.lat;
  const gLng = result?.geometry?.location?.lng;
  if (typeof gLat !== "number" || typeof gLng !== "number") return null;

  return {
    address: result.formatted_address || query,
    placeId: result.place_id || "",
    lat: gLat,
    lng: gLng,
    source: "geocode",
  };
}

/** Resolve hotel/address text, biased to a known city. Always falls back to city center. */
export async function geocodeStay(opts: {
  query: string;
  city: string;
  lat: number;
  lng: number;
  apiKey?: string | null;
}): Promise<GeocodedStay> {
  const query = opts.query.trim();
  const enriched = enrichQuery(query, opts.city);
  const apiKey = opts.apiKey ?? process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const fromPlace = await findPlace(enriched, apiKey, opts.lat, opts.lng);
      if (fromPlace) return fromPlace;
      const fromGeocode = await geocodeAddress(enriched, apiKey, opts.lat, opts.lng);
      if (fromGeocode) return fromGeocode;
    } catch {
      // city fallback
    }
  }

  return {
    address: query,
    placeId: "",
    lat: opts.lat,
    lng: opts.lng,
    source: "city",
  };
}

export { enrichQuery };
