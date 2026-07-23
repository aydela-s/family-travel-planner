import { CityConfig } from "@/config/city-pricing";
import { TripPlan } from "@/types/trip-plan";

/**
 * Reference daily driving distance used to convert a city's average fuel
 * consumption into a per-km rate. When actual route distance is known,
 * fuel cost scales from this baseline instead of always using the flat
 * avgFuelLitersPerDay figure.
 */
const REFERENCE_DRIVING_KM = 40;

function roundMoney(amount: number, currency: string): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

export function familyTransitRiders(plan: TripPlan): number {
  return plan.adults + plan.children.length;
}

/** Car rental rule: fuel cost derived from the day's actual driven distance. */
export function estimateFuelCostForDriving(city: CityConfig, totalKm: number): number {
  if (totalKm <= 0) return 0;
  const litersPerKm = city.transport.avgFuelLitersPerDay / REFERENCE_DRIVING_KM;
  const liters = totalKm * litersPerKm;
  return roundMoney(city.transport.fuelPricePerLiter * liters, city.currency);
}

/**
 * Car rental rule: paid parking at each stop on the day's route.
 * `stopCount` is typically the number of route legs (each arrival parks).
 */
export function estimateParkingCost(city: CityConfig, stopCount: number): number {
  const stops = Math.max(0, Math.floor(stopCount));
  if (stops <= 0) return 0;
  return roundMoney(city.transport.parkingFeePerStop * stops, city.currency);
}

export type PublicTransitChoice = {
  cost: number;
  label: string;
  method: "day-pass" | "individual";
};

/**
 * Public transit rule: pick the cheaper of a day pass vs individual
 * tickets for the whole family, based on how many rides the day needs.
 */
export function choosePublicTransitFare(
  city: CityConfig,
  plan: TripPlan,
  rideCount: number,
): PublicTransitChoice {
  const riders = familyTransitRiders(plan);
  const rides = Math.max(1, rideCount);
  const dayPassTotal = city.transport.publicTransitDayPass * riders;
  const individualTotal = city.transport.publicTransitSingleRide * riders * rides;

  if (dayPassTotal <= individualTotal) {
    return {
      cost: dayPassTotal,
      label: `Public transit day pass × ${riders}`,
      method: "day-pass",
    };
  }
  return {
    cost: individualTotal,
    label: `Public transit (${rides} rides × ${riders})`,
    method: "individual",
  };
}

/** Taxi rule: sum per-segment ride estimates for the day. */
export function estimateTaxiDailyCost(segmentCosts: number[]): number {
  return Math.round(segmentCosts.reduce((sum, cost) => sum + cost, 0) * 100) / 100;
}
