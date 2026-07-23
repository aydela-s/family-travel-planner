import { CityConfig } from "@/config/city-pricing";
import {
  choosePublicTransitFare,
  estimateFuelCostForDriving,
  estimateParkingCost,
  estimateTaxiDailyCost,
} from "@/lib/pricing/transport-planner";
import { calculateRideCost } from "@/lib/pricing/transport-cost";
import { TripPlan } from "@/types/trip-plan";

export type DirectionsResult = {
  distanceKm: number;
  durationMin: number;
  cost: number;
  provider: string;
  source: "google" | "estimated";
};

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getDirections(
  city: CityConfig,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transportType: string,
  providerIndex: number,
): Promise<DirectionsResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const mode = transportType === "walking" ? "walking" : "driving";
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&mode=${mode}&key=${apiKey}`;
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

  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const roadFactor = transportType === "walking" ? 1.3 : 1.45;
  const distanceKm = Math.max(0.5, Math.round(straight * roadFactor * 10) / 10);
  const durationMin =
    transportType === "walking"
      ? Math.round(distanceKm * 12)
      : Math.round(distanceKm * 3.2 + 5);

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
  return { cost, label: "Taxi" };
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
