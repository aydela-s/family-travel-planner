import { NextResponse } from "next/server";
import {
  PlacesApiError,
  PlacesApiKeyMissingError,
  resolvePlacesApiKey,
} from "@/lib/maps/get-top-activities";
import { getOrFetchTopActivities } from "@/lib/maps/top-activities-cache";

const MAX_CATEGORIES = 8;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** GET ?destination=&category=&maxResults= — one category. */
export async function GET(request: Request) {
  if (!resolvePlacesApiKey()) {
    return NextResponse.json({ error: "Places API unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const maxParam = searchParams.get("maxResults");
  const maxResults =
    maxParam != null && maxParam !== "" ? Number(maxParam) : undefined;

  if (!destination) return badRequest("destination is required");
  if (!category) return badRequest("category is required");
  if (maxResults != null && (Number.isNaN(maxResults) || maxResults < 1)) {
    return badRequest("maxResults must be a positive number");
  }

  try {
    const result = await getOrFetchTopActivities(destination, category, {
      maxResults: maxResults && Number.isFinite(maxResults) ? maxResults : undefined,
    });
    return NextResponse.json({
      destination,
      category,
      cached: result.cached,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
      places: result.places,
    });
  } catch (err) {
    return placesErrorResponse(err);
  }
}

/**
 * POST { destination, categories: string[], maxResults? } —
 * parallel per-category fetches (capped).
 */
export async function POST(request: Request) {
  if (!resolvePlacesApiKey()) {
    return NextResponse.json({ error: "Places API unavailable" }, { status: 503 });
  }

  let body: {
    destination?: unknown;
    categories?: unknown;
    maxResults?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const destination =
    typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) return badRequest("destination is required");

  const rawCategories = Array.isArray(body.categories) ? body.categories : [];
  const categories = [
    ...new Set(
      rawCategories
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_CATEGORIES);

  if (categories.length === 0) {
    return badRequest("categories must be a non-empty string array");
  }

  const maxResults =
    typeof body.maxResults === "number" && Number.isFinite(body.maxResults)
      ? body.maxResults
      : undefined;
  if (maxResults != null && maxResults < 1) {
    return badRequest("maxResults must be a positive number");
  }

  try {
    const results = await Promise.all(
      categories.map(async (category) => {
        const result = await getOrFetchTopActivities(destination, category, {
          maxResults,
        });
        return {
          category,
          cached: result.cached,
          fetchedAt: new Date(result.fetchedAt).toISOString(),
          places: result.places,
        };
      }),
    );

    return NextResponse.json({ destination, results });
  } catch (err) {
    return placesErrorResponse(err);
  }
}

function placesErrorResponse(err: unknown) {
  if (err instanceof PlacesApiKeyMissingError) {
    return NextResponse.json({ error: "Places API unavailable" }, { status: 503 });
  }
  if (err instanceof PlacesApiError) {
    console.warn("[places:top-activities]", err.message);
    return NextResponse.json({ error: "Failed to fetch places" }, { status: 502 });
  }
  console.warn("[places:top-activities] unexpected error", err);
  return NextResponse.json({ error: "Failed to fetch places" }, { status: 502 });
}
