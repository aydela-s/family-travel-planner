import { CityConfig } from "@/config/city-pricing";
import { directionsTravelMode, WALKABLE_TAXI_KM } from "@/config/travel-times";
import {
  choosePublicTransitFare,
  estimateFuelCostForDriving,
  estimateParkingCost,
  estimateTaxiDailyCost,
} from "@/lib/pricing/transport-planner";
import { calculateRideCost } from "@/lib/pricing/transport-cost";
import { estimateRoutedMetrics, haversineKm } from "@/lib/maps/travel-estimate";
import { TripPlan } from "@/types/trip-plan";

export type DirectionsResult = {
  distanceKm: number;
  durationMin: number;
  cost: number;
  provider: string;
  source: "google" | "estimated";
};

export { haversineKm } from "@/lib/maps/travel-estimate";

export async function getDirections(
  city: CityConfig,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transportType: string,
  providerIndex: number,
): Promise<DirectionsResult> {
  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);

  // Families walk between same-place / campus hops — do not bill an Uber.
  if (transportType === "taxis" && straight <= WALKABLE_TAXI_KM) {
    const walk = estimateRoutedMetrics(straight, true);
    return {
      distanceKm: walk.distanceKm,
      durationMin: walk.durationMin,
      cost: 0,
      provider: "Walk",
      source: "estimated",
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const travelMode = directionsTravelMode(transportType);

  if (apiKey) {
    try {
      const params = new URLSearchParams({
        origin: `${from.lat},${from.lng}`,
        destination: `${to.lat},${to.lng}`,
        mode: travelMode,
        key: apiKey,
      });
      if (travelMode === "transit") {
        params.set("departure_time", String(Math.floor(Date.now() / 1000)));
      }
      const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      const leg = data.routes?.[0]?.legs?.[0];
      if (leg) {
        const distanceKm = leg.distance.value / 1000;
        const durationMin = Math.ceil(leg.duration.value / 60);
        const { cost, provider } =
          transportType === "taxis"
            ? calculateRideCost(city, distanceKm, durationMin, providerIndex)
            : { cost: 0, provider: "" };
        return { distanceKm, durationMin, cost, provider, source: "google" };
      }
    } catch {
      // fall through to estimate
    }
  }

  const { distanceKm, durationMin } = estimateRoutedMetrics(straight, travelMode);

  const { cost, provider } =
    transportType === "taxis"
      ? calculateRideCost(city, distanceKm, durationMin, providerIndex)
      : { cost: 0, provider: "" };

  return { distanceKm, durationMin, cost, provider, source: "estimated" };
}

export function estimateWalkingMetrics(
  totalKm: number,
  walkingLimit: string,
): { steps: number; distanceKm: number } {
  const multiplier = walkingLimit === "low" ? 0.7 : walkingLimit === "high" ? 1.2 : 1;
  const distanceKm = Math.round(totalKm * multiplier * 10) / 10;
  return { steps: Math.round(distanceKm * 1300), distanceKm };
}

export function estimateDailyTransport(
  transportType: string,
  city: CityConfig,
  plan: TripPlan,
  segmentCosts: number[],
  totalKm: number,
): {
  cost: number;
  label: string;
  steps?: number;
  distanceKm?: number;
  fuelCost?: number;
  parkingCost?: number;
} {
  if (transportType === "walking") {
    const { steps, distanceKm } = estimateWalkingMetrics(totalKm, plan.walkingLimit);
    return { cost: 0, label: `${steps.toLocaleString()} steps · ${distanceKm} km walking`, steps, distanceKm };
  }
  if (transportType === "car-rental") {
    const fuelCost = estimateFuelCostForDriving(city, totalKm);
    // One parking fee per destination stop (each route leg arrives somewhere you park).
    const parkingStops = Math.max(totalKm > 0 ? 1 : 0, segmentCosts.length);
    const parkingCost = estimateParkingCost(city, parkingStops);
    const roundedKm = Math.round(totalKm);
    const cost = Math.round((fuelCost + parkingCost) * 100) / 100;
    return {
      cost,
      label:
        parkingCost > 0
          ? `Car · fuel + parking (${roundedKm} km, ${parkingStops} stop${parkingStops === 1 ? "" : "s"})`
          : `Car · est. fuel (${roundedKm} km)`,
      fuelCost,
      parkingCost,
      distanceKm: roundedKm,
    };
  }
  if (transportType === "public-transportation") {
    const choice = choosePublicTransitFare(city, plan, segmentCosts.length);
    return { cost: choice.cost, label: choice.label };
  }
  const cost = estimateTaxiDailyCost(segmentCosts);
  const rideCount = segmentCosts.filter((c) => c > 0).length;
  return {
    cost,
    label: rideCount > 0 ? `Uber · ${rideCount} ride${rideCount === 1 ? "" : "s"}` : "Uber",
  };
}

/**
 * Movement line for the day card (FAM-38): "{label}: {cost}" — no "Transport" suffix.
 * UI already prefixes with "Movement:".
 */
export function formatTransportDisplay(
  _transportType: string,
  movementLabel: string,
  transportCost: number,
  currencySymbol: string,
): string {
  const costStr =
    transportCost > 0 ? `${currencySymbol}${transportCost.toFixed(2)}` : "Included / walking";
  return `${movementLabel}: ${costStr}`;
}
