import { CityConfig } from "@/config/city-pricing";
import { PUBLIC_TRANSIT_CLUSTER_KM } from "@/config/cluster-distances";
import { restaurantsForCity } from "@/config/city-restaurants";
import { haversineKm } from "@/lib/maps/directions";
import { RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type TransitModeResolution = {
  plan: TripPlan;
  /** Set when we forced / will force a switch away from public transit. */
  transportNote?: string;
  switched: boolean;
};

function taxiFallbackNote(cityName: string): string {
  return `We switched this trip to taxis because public transit wouldn’t work well for the stops in ${cityName}.`;
}

/**
 * Cities with no usable public transit should never stay on that mode
 * (wizard grays it out; this covers chips/share/legacy plans).
 */
export function resolveTransitSelection(
  plan: TripPlan,
  city: CityConfig,
): TransitModeResolution {
  if (plan.transportationType !== "public-transportation") {
    return { plan, switched: false };
  }
  if (city.transitQuality !== "none") {
    return { plan, switched: false };
  }
  return {
    plan: { ...plan, transportationType: "taxis" },
    transportNote: taxiFallbackNote(city.name),
    switched: true,
  };
}

type Coord = { lat: number; lng: number };

function placeCoordsFromTitle(title: string, city: CityConfig): Coord | null {
  const needle = title.toLowerCase();
  for (const landmark of city.landmarks) {
    if (needle.includes(landmark.name.toLowerCase())) {
      return { lat: landmark.lat, lng: landmark.lng };
    }
  }
  for (const restaurant of restaurantsForCity(city)) {
    if (needle.includes(restaurant.name.toLowerCase())) {
      return { lat: restaurant.lat, lng: restaurant.lng };
    }
  }
  return null;
}

function locatedStopsForDay(
  activities: RawItinerary["days"][0]["activities"],
  city: CityConfig,
): Coord[] {
  const stops: Coord[] = [];
  for (const activity of activities) {
    if (activity.type !== "activity" && activity.type !== "meal") continue;
    const coord = placeCoordsFromTitle(activity.title, city);
    if (coord) stops.push(coord);
  }
  return stops;
}

/**
 * For limited-transit cities: any day with a consecutive located leg longer
 * than the preferred public-transit cluster radius is too hard for transit.
 */
export function transitScheduleIsDifficult(
  raw: RawItinerary,
  plan: TripPlan,
  city: CityConfig,
): boolean {
  if (plan.transportationType !== "public-transportation") return false;
  if (city.transitQuality !== "limited") return false;

  for (const day of raw.days) {
    const stops = locatedStopsForDay(day.activities, city);
    for (let i = 1; i < stops.length; i++) {
      const km = haversineKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
      if (km > PUBLIC_TRANSIT_CLUSTER_KM) return true;
    }
  }
  return false;
}

export function switchPlanToTaxis(plan: TripPlan, city: CityConfig): TransitModeResolution {
  return {
    plan: { ...plan, transportationType: "taxis" },
    transportNote: taxiFallbackNote(city.name),
    switched: true,
  };
}

export type GettingAroundOption = "car-rental" | "taxis" | "public-transportation";

/** Always show all three modes; public transit may be disabled for the city. */
export function transportationOptionsForCity(
  _city: CityConfig,
): GettingAroundOption[] {
  return ["car-rental", "taxis", "public-transportation"];
}

export function isPublicTransitSelectable(city: CityConfig): boolean {
  return city.transitQuality !== "none";
}

export function limitedTransitWarning(city: CityConfig): string | null {
  if (city.transitQuality !== "limited") return null;
  return `${city.name} is spread out — transit coverage is limited. Car or taxis usually work better.`;
}

/** Shown when Public transit is grayed out (transitQuality none). */
export function unavailableTransitNote(city: CityConfig): string | null {
  if (city.transitQuality !== "none") return null;
  return `Public transit isn’t available for planning in ${city.name} — we don’t have reliable coverage data for this destination yet. Choose car or taxis instead.`;
}
