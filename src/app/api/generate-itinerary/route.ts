import { NextResponse } from "next/server";
import { applyFallbackDisplayTitles } from "@/lib/ai/display-titles";
import { enrichItinerary } from "@/lib/enrich-itinerary";
import { isValidTripPlan, normalizeRawItinerary } from "@/lib/itinerary";
import { resolvePlanningCity } from "@/lib/maps/places-city-config";
import { applyDestinationCenter } from "@/lib/maps/resolve-destination-center";
import { planTrip } from "@/lib/planning-engine";
import { AdjustActionId } from "@/lib/planning-engine/adjust-types";
import { resolveStayOntoPlan } from "@/lib/planning-engine/resolve-stay";
import { Itinerary, RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

type GenerateRequest = TripPlan & {
  relaxed?: boolean;
  adjustDay?: number;
  adjustAction?: AdjustActionId;
  adjustNote?: string;
  existingItinerary?: Itinerary;
};

function extractTripPlan(body: GenerateRequest): TripPlan {
  const {
    relaxed: _r,
    adjustDay: _a,
    adjustAction: _aa,
    adjustNote: _n,
    existingItinerary: _e,
    ...plan
  } = body;
  return plan;
}

function toRawItinerary(itinerary: Itinerary): RawItinerary {
  return {
    days: itinerary.days.map((d) => ({
      day: d.day,
      activities: d.activities.map(({ time, title, type, notes }) => ({
        time,
        title,
        type,
        notes,
      })),
    })),
  };
}

function stageMs(started: number) {
  return Math.round(performance.now() - started);
}

export async function POST(request: Request) {
  const totalStarted = performance.now();
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!isValidTripPlan(body)) {
      return NextResponse.json({ error: "Invalid TripPlan data." }, { status: 400 });
    }

    let plan = extractTripPlan(body);
    if (!plan.accommodationType) {
      plan.accommodationType = "";
    }

    let t = performance.now();
    plan = await applyDestinationCenter(plan);
    const destinationMs = stageMs(t);

    t = performance.now();
    plan = await resolveStayOntoPlan(plan);
    const stayMs = stageMs(t);

    t = performance.now();
    const city = await resolvePlanningCity(plan);
    const cityMs = stageMs(t);

    const enrichedDay = body.existingItinerary?.days.find((d) => d.day === body.adjustDay);

    t = performance.now();
    const { raw, plan: effectivePlan, transportNote, blueprint, conflicts } = planTrip(plan, {
      relaxed: body.relaxed,
      adjustDay: body.adjustDay,
      adjustAction: body.adjustAction,
      adjustNote: body.adjustNote,
      existingItinerary: body.existingItinerary
        ? toRawItinerary(body.existingItinerary)
        : undefined,
      enrichedDay,
      cityOverride: city,
    });
    const planMs = stageMs(t);

    const normalized = normalizeRawItinerary(raw, effectivePlan);

    t = performance.now();
    let enriched = await enrichItinerary(normalized, effectivePlan, {
      adjustDay: body.adjustDay,
      adjustAction: body.adjustAction,
      previousItinerary: body.existingItinerary,
      transportNote,
      cityOverride: city,
      conflicts,
    });
    const enrichMs = stageMs(t);

    enriched = applyFallbackDisplayTitles(enriched, blueprint);

    console.info("[generate-itinerary] timing", {
      destinationMs,
      stayMs,
      cityMs,
      planMs,
      enrichMs,
      totalMs: stageMs(totalStarted),
      days: enriched.days.length,
      cityId: city.id,
    });

    return NextResponse.json({
      ...enriched,
      transportationType: effectivePlan.transportationType,
    });
  } catch (error) {
    console.error("generate-itinerary error:", error);

    const message = error instanceof Error ? error.message : "Failed to generate itinerary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
