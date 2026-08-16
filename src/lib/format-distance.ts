/**
 * Distances are stored in kilometers internally (Google Directions, haversine)
 * but the planner never shows kilometers to the user. Every user-facing
 * distance goes through this module.
 */
export const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

/** Rounded miles value — one decimal under 10 mi, whole miles above. */
export function roundMiles(km: number): number {
  const miles = kmToMiles(Math.max(0, km));
  return miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles);
}

/** User-facing distance label, e.g. "0.6 mi", "5.2 mi", "31 mi". */
export function formatMiles(km: number): string {
  return `${roundMiles(km)} mi`;
}
