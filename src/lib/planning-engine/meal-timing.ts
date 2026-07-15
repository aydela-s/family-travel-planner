import { CityConfig } from "@/config/city-pricing";
import { minutesToTime } from "@/lib/schedule/timeline";
import { ActivityLocation } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type MealTimeWindow = {
  minMin: number;
  maxMin: number;
  defaultMin: number;
};

function oldestChildAge(plan: TripPlan): number | null {
  if (plan.children.length === 0) return null;
  return Math.max(...plan.children);
}

function youngestChildAge(plan: TripPlan): number | null {
  if (plan.children.length === 0) return null;
  return Math.min(...plan.children);
}

/** P1: oldest ≤ 7 → 11:30–12:00; oldest 7+ (or adults only) → 12:00–13:30 */
export function lunchTimeWindow(plan: TripPlan): MealTimeWindow {
  const oldest = oldestChildAge(plan);
  if (oldest === null || oldest > 7) {
    return { minMin: 12 * 60, maxMin: 13 * 60 + 30, defaultMin: 12 * 60 + 30 };
  }
  if (oldest < 7) {
    return { minMin: 11 * 60 + 30, maxMin: 12 * 60, defaultMin: 11 * 60 + 45 };
  }
  return { minMin: 12 * 60, maxMin: 12 * 60, defaultMin: 12 * 60 };
}

export function lunchDefaultTime(plan: TripPlan): string {
  return minutesToTime(lunchTimeWindow(plan).defaultMin);
}

/** Earliest valid lunch start at or after cursor + travel, within the age window. */
export function clampLunchStart(cursorAfterTravel: number, plan: TripPlan): number {
  const { minMin, maxMin } = lunchTimeWindow(plan);
  const preferred = Math.max(cursorAfterTravel, minMin);
  if (preferred <= maxMin) return preferred;
  return cursorAfterTravel;
}

/**
 * P1 dinner windows:
 * - oldest ≤ 7 → 17:00–19:00
 * - youngest ≥ 7 → 18:00–20:00
 * Mixed ages use the intersection of every rule that applies.
 */
export function dinnerTimeWindow(plan: TripPlan): MealTimeWindow {
  const oldest = oldestChildAge(plan);
  const youngest = youngestChildAge(plan);

  if (oldest === null) {
    return { minMin: 18 * 60, maxMin: 20 * 60, defaultMin: 18 * 60 + 30 };
  }

  const windows: MealTimeWindow[] = [];
  if (youngest !== null && youngest <= 7) {
    windows.push({ minMin: 17 * 60, maxMin: 19 * 60, defaultMin: 18 * 60 });
  }
  if (oldest !== null && oldest >= 7) {
    windows.push({ minMin: 18 * 60, maxMin: 20 * 60, defaultMin: 18 * 60 + 30 });
  }

  if (windows.length === 0) {
    return { minMin: 17 * 60, maxMin: 19 * 60, defaultMin: 18 * 60 };
  }

  if (windows.length === 1) {
    return windows[0];
  }

  const minMin = Math.max(...windows.map((w) => w.minMin));
  const maxMin = Math.min(...windows.map((w) => w.maxMin));
  const defaultMin = Math.min(Math.max(18 * 60 + 30, minMin), maxMin);
  return { minMin, maxMin, defaultMin };
}

export function dinnerDefaultTime(plan: TripPlan): string {
  return minutesToTime(dinnerTimeWindow(plan).defaultMin);
}

export function clampToDinnerWindow(minutes: number, plan: TripPlan): number {
  const { minMin, maxMin } = dinnerTimeWindow(plan);
  return Math.min(Math.max(minutes, minMin), maxMin);
}

/** P0: place grocery near the last stop on the route home, not a static city offset. */
export function groceryLocationNearRoute(
  activities: Array<{ location?: ActivityLocation }>,
  groceryIndex: number,
  city: CityConfig,
): ActivityLocation {
  const before = activities.slice(0, groceryIndex).filter((a) => a.location);
  const anchor = before[before.length - 1]?.location;
  if (anchor) {
    return {
      name: `Supermarket near ${anchor.name}`,
      lat: anchor.lat + 0.003,
      lng: anchor.lng + 0.002,
    };
  }
  return {
    name: "Neighborhood supermarket",
    lat: city.lat + 0.012,
    lng: city.lng - 0.008,
  };
}
