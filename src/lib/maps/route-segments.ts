import { CityConfig } from "@/config/city-pricing";
import { getDirections } from "@/lib/maps/directions";
import { TripPlan } from "@/types/trip-plan";
import { ItineraryActivity, RouteSegment } from "@/types/itinerary";

export type RouteBuildResult = {
  routeSegments: RouteSegment[];
  totalKm: number;
  segmentCosts: number[];
  segmentDurations: number[];
};

/** Build map directions between consecutive located activities (final day list). */
export async function buildRouteSegments(
  activities: ItineraryActivity[],
  city: CityConfig,
  plan: TripPlan,
): Promise<RouteBuildResult> {
  const locActivities = activities.filter((a) => a.location);
  const routeSegments: RouteSegment[] = [];
  const segmentCosts: number[] = [];
  const segmentDurations: number[] = [];
  let totalKm = 0;

  for (let i = 0; i < locActivities.length - 1; i++) {
    const from = locActivities[i].location!;
    const to = locActivities[i + 1].location!;
    const dir = await getDirections(
      city,
      from,
      to,
      plan.transportationType,
      i % city.taxiProviders.length,
    );
    totalKm += dir.distanceKm;
    segmentCosts.push(plan.transportationType === "taxis" ? dir.cost : 0);
    segmentDurations.push(dir.durationMin);
    routeSegments.push({
      from: from.name,
      to: to.name,
      distanceKm: dir.distanceKm,
      durationMin: dir.durationMin,
      cost: dir.cost,
      provider: dir.provider || undefined,
    });
  }

  return { routeSegments, totalKm, segmentCosts, segmentDurations };
}
