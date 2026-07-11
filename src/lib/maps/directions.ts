import { CityConfig } from "@/config/city-pricing";
import { calculateRideCost, estimateSegmentDistance } from "@/lib/pricing/transport-cost";

export type DirectionsResult = {
  distanceKm: number;
  durationMin: number;
  cost: number;
  provider: string;
  source: "google" | "estimated";
};

function haversineKm(
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

export function estimateFuelCost(city: CityConfig): number {
  return Math.round(city.transport.fuelPricePerLiter * city.transport.avgFuelLitersPerDay * 100) / 100;
}

export function estimateDailyTransport(
  transportType: string,
  city: CityConfig,
  segmentCosts: number[],
  totalKm: number,
  walkingLimit: string,
): { cost: number; label: string; steps?: number; distanceKm?: number; fuelCost?: number } {
  if (transportType === "walking") {
    const { steps, distanceKm } = estimateWalkingMetrics(totalKm, walkingLimit);
    return { cost: 0, label: `${steps.toLocaleString()} steps · ${distanceKm} km walking`, steps, distanceKm };
  }
  if (transportType === "car-rental") {
    const fuelCost = estimateFuelCost(city);
    return { cost: fuelCost, label: `Car rental · est. fuel`, fuelCost };
  }
  if (transportType === "public-transportation") {
    const cost = city.transport.publicTransitDayPass;
    return { cost, label: `Public transit day pass` };
  }
  const cost = Math.round(segmentCosts.reduce((s, c) => s + c, 0) * 100) / 100;
  return { cost, label: `Taxi / rideshare` };
}

/** Movement description only — cost comes from costBreakdown.transport */
export function formatTransportDisplay(
  transportType: string,
  movementLabel: string,
  transportCost: number,
  currencySymbol: string,
): string {
  const costStr =
    transportCost > 0 ? `${currencySymbol}${transportCost.toFixed(2)}` : "Included / walking";
  return `${movementLabel} · Family transport ${costStr}`;
}
