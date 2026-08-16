import { CityConfig } from "@/config/city-pricing";
import { getDirections } from "@/lib/maps/directions";
import { familyTravelBufferMin } from "@/lib/schedule/travel-buffer";
import { TripPlan } from "@/types/trip-plan";
import { ItineraryActivity, RouteSegment } from "@/types/itinerary";

export type RouteBuildResult = {
  routeSegments: RouteSegment[];
  totalKm: number;
  segmentCosts: number[];
  /** Scheduled block per leg — travel time plus the family buffer. */
  segmentDurations: number[];
};

/**
 * Minutes the timeline reserves for a leg. Segment `durationMin` stays the
 * actual travel time so the itinerary never reports the buffer as driving time.
 */
export function scheduledSegmentMinutes(
  segments: RouteSegment[],
  plan: TripPlan,
): number[] {
  const fallback = familyTravelBufferMin(plan);
  return segments.map((s) =>
    s.distanceKm <= 0 && s.durationMin <= 0
      ? 0
      : s.durationMin + (s.bufferMin ?? fallback),
  );
}

/** Build map directions between consecutive located activities (final day list). */
export async function buildRouteSegments(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
): Promise<RouteBuildResult> {
  const locActivities = activities.filter((a) => a.location);
  const routeSegments: RouteSegment[] = [];
  const segmentCosts: number[] = [];
  let totalKm = 0;
  const bufferMin = familyTravelBufferMin(plan);

  for (let i = 0; i < locActivities.length - 1; i++) {
    const from = locActivities[i]!.location!;
    const to = locActivities[i + 1]!.location!;
    // Picnic / break / explore at the same venue must not bill a separate Uber.
    const sameVenue = sameVenueName(from.name, to.name);
    const dir = sameVenue
      ? {
          distanceKm: 0,
          durationMin: 0,
          cost: 0,
          provider: "Walk",
          source: "estimated" as const,
        }
      : await getDirections(
          city,
          from,
          to,
          plan.transportationType,
          i % city.taxiProviders.length,
        );
    totalKm += dir.distanceKm;
    segmentCosts.push(plan.transportationType === "taxis" ? dir.cost : 0);
    routeSegments.push({
      from: from.name,
      to: to.name,
      distanceKm: dir.distanceKm,
      durationMin: dir.durationMin,
      bufferMin: dir.distanceKm > 0 || dir.durationMin > 0 ? bufferMin : 0,
      cost: dir.cost,
      provider: dir.provider || undefined,
    });
  }

  return {
    routeSegments,
    totalKm,
    segmentCosts,
    segmentDurations: scheduledSegmentMinutes(routeSegments, plan),
  };
}

function sameVenueName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(area|café|cafe|near)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}
