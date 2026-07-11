import { CityConfig } from "@/config/city-pricing";

export function calculateRideCost(
  city: CityConfig,
  distanceKm: number,
  durationMin: number,
  providerIndex = 0,
): { cost: number; provider: string } {
  const provider = city.taxiProviders[providerIndex] ?? city.taxiProviders[0];
  const base =
    city.transport.baseFare +
    distanceKm * city.transport.ratePerKm +
    durationMin * city.transport.ratePerMin;
  const cost = Math.round(base * provider.multiplier * 100) / 100;
  return { cost, provider: provider.label };
}

export function estimateSegmentDistance(
  transportType: string,
  walkingLimit: string,
): { distanceKm: number; durationMin: number } {
  const baseKm =
    transportType === "walking"
      ? walkingLimit === "low"
        ? 0.8
        : walkingLimit === "high"
          ? 2.2
          : 1.4
      : 3.5;
  const durationMin = transportType === "walking" ? Math.round(baseKm * 12) : Math.round(baseKm * 3.5);
  return { distanceKm: baseKm, durationMin };
}
