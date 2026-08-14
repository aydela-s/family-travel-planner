import { NextResponse } from "next/server";
import { applyFallbackDisplayTitles } from "@/lib/ai/display-titles";
import { polishItineraryWithAi } from "@/lib/ai/polish-itinerary";
import { shouldEnrichItineraryWithAi } from "@/lib/ai/config";
import { enrichItinerary, isDemoMode } from "@/lib/enrich-itinerary";
import { isValidTripPlan, normalizeRawItinerary } from "@/lib/itinerary";
import { resolvePlanningCity } from "@/lib/maps/places-city-config";
import { planTrip } from "@/lib/planning-engine";
import { AdjustActionId } from "@/lib/planning-engine/adjust-types";
import { resolveStayOntoPlan } from "@/lib/planning-engine/resolve-stay";
import { Itinerary, RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

type GenerateRequest = TripPlan & {
  demo?: boolean;
  relaxed?: boolean;
  adjustDay?: number;
  adjustAction?: AdjustActionId;
  adjustNote?: string;
  existingItinerary?: Itinerary;
};

function extractTripPlan(body: GenerateRequest): TripPlan {
  const {
    demo: _d,
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!isValidTripPlan(body)) {
      return NextResponse.json({ error: "Invalid TripPlan data." }, { status: 400 });
    }

    let plan = extractTripPlan(body);
    if (!plan.accommodationType) {
      plan.accommodationType = "";
    }
    plan = await resolveStayOntoPlan(plan);

    const useDemo = body.demo === true || isDemoMode();
    const city = await resolvePlanningCity(plan);

    const enrichedDay = body.existingItinerary?.days.find((d) => d.day === body.adjustDay);

    const { raw, plan: effectivePlan, transportNote, blueprint } = planTrip(plan, {
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

    const normalized = normalizeRawItinerary(raw, effectivePlan);

    let enriched = await enrichItinerary(normalized, effectivePlan, {
      adjustDay: body.adjustDay,
      adjustAction: body.adjustAction,
      previousItinerary: body.existingItinerary,
      transportNote,
      cityOverride: city,
    });

    // Theme display titles always; optional AI polish never blocks the deterministic plan.
    enriched = applyFallbackDisplayTitles(enriched, blueprint);
    if (shouldEnrichItineraryWithAi(useDemo)) {
      try {
        enriched = await polishItineraryWithAi(enriched, effectivePlan, blueprint);
      } catch (aiError) {
        console.warn("AI Gateway polish skipped:", aiError);
      }
    }

    return NextResponse.json({
      ...enriched,
      demo: useDemo,
      transportationType: effectivePlan.transportationType,
    });
  } catch (error) {
    console.error("generate-itinerary error:", error);

    const message = error instanceof Error ? error.message : "Failed to generate itinerary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
