import { CityConfig } from "@/config/city-pricing";
import { getDirections } from "@/lib/maps/directions";
import { haversineKm } from "@/lib/maps/travel-estimate";
import { stayHomeLocation } from "@/lib/planning-engine/stay-home";
import { familyTravelBufferMin } from "@/lib/schedule/travel-buffer";
import { TripPlan } from "@/types/trip-plan";
import { ActivityLocation, ItineraryActivity, RouteSegment } from "@/types/itinerary";

/** Stops closer than this are the same place — no taxi hop. */
const SAME_PLACE_KM = 0.3;

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

function isStayLocation(loc: ActivityLocation, stay: ActivityLocation | null): boolean {
  if (!stay) return false;
  return sameVenueName(loc.name, stay.name);
}

/**
 * Build map directions for the day, including the hop from the stay to the
 * first stop and the hop from the last stop back home when a stay pin exists.
 */
export async function buildRouteSegments(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
): Promise<RouteBuildResult> {
  const stay = stayHomeLocation(plan);
  const locActivities = activities.filter((a) => a.location);
  const stops: ActivityLocation[] = [];

  if (stay && locActivities[0]?.location && !isStayLocation(locActivities[0].location, stay)) {
    stops.push(stay);
  }
  for (const a of locActivities) {
    if (a.location) stops.push(a.location);
  }
  if (
    stay &&
    locActivities.length > 0 &&
    locActivities[locActivities.length - 1]?.location &&
    !isStayLocation(locActivities[locActivities.length - 1]!.location!, stay)
  ) {
    stops.push(stay);
  }

  const routeSegments: RouteSegment[] = [];
  const segmentCosts: number[] = [];
  let totalKm = 0;
  const bufferMin = familyTravelBufferMin(plan);

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i]!;
    const to = stops[i + 1]!;
    // Picnic / break / explore at the same venue must not bill a separate Uber.
    const sameVenue =
      sameVenueName(from.name, to.name) ||
      haversineKm(from.lat, from.lng, to.lat, to.lng) < SAME_PLACE_KM;
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
          i % Math.max(1, city.taxiProviders.length),
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
