import type { CityConfig, Landmark } from "@/config/city-pricing";
import { clusterRadiusKm } from "@/config/cluster-distances";
import { haversineKm } from "@/lib/maps/directions";
import { getFamilyAgeProfile, landmarkAgeScore } from "@/lib/schedule/family-profile";
import { isLandmarkOpenForVisit, type VisitWindow } from "@/lib/schedule/landmark-hours";
import {
  isOutdoorPlayground,
  LOW_FRICTION_PREFERRED_KM,
  LOW_FRICTION_STAY_KM,
} from "@/lib/planning-engine/staged/landmark-experience";
import type { DayBlueprint } from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";

export type SelectSupportOptions = {
  visitWindow?: VisitWindow;
  ledgerNames: Set<string>;
  /** Already committed today (anchor + prior support). */
  alreadyToday: Landmark[];
};

function maxSupport(day: DayBlueprint): number {
  if (day.role === "departure" || day.role === "recovery") return 0;
  if (day.constraints.some((c) => c.type === "require_half_day_window")) {
    return Math.min(1, day.capacity.maxSupportStops);
  }
  const maxAct = day.capacity.maxActivitiesPerDay;
  // Anchor consumes 1; remaining capacity for support
  return Math.min(day.capacity.maxSupportStops, Math.max(0, maxAct - 1));
}

function stayKm(landmark: Landmark, plan: TripPlan): number | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return haversineKm(landmark.lat, landmark.lng, plan.stayLat, plan.stayLng);
}

/** Score a support candidate — complementary, nearby, not stealing the theme. */
export function scoreSupportCandidate(
  landmark: Landmark,
  day: DayBlueprint,
  plan: TripPlan,
  anchor: Landmark,
): number {
  const profile = getFamilyAgeProfile(plan);
  let score = 20 + landmarkAgeScore(landmark, profile) * 0.5;
  const km = haversineKm(landmark.lat, landmark.lng, anchor.lat, anchor.lng);
  const radius = clusterRadiusKm(plan);
  if (km <= radius) score += (radius - km) * 6;
  else score -= (km - radius) * 8;

  // Arrival: support must stay near the hotel, not chase a far scenic anchor
  if (day.role === "arrival") {
    const fromStay = stayKm(landmark, plan);
    if (fromStay != null) {
      if (fromStay <= LOW_FRICTION_PREFERRED_KM) score += 35;
      else if (fromStay <= LOW_FRICTION_STAY_KM) score += 10;
      else score -= 40;
    }
    if (landmark.adultPrice > 0) score -= 25;
    if (landmark.interestTags.includes("theme-parks")) score -= 40;
    if (isOutdoorPlayground(landmark) || landmark.interestTags.includes("parks")) score += 12;
  }

  // Complementary: share preferred types but don't duplicate anchor's primary coverage tags entirely
  const primary = day.theme.primaryTags;
  const overlapsPrimary =
    primary.length > 0 && primary.every((t) => landmark.interestTags.includes(t));
  if (overlapsPrimary && landmark.name !== anchor.name) score -= 15;

  for (const tag of day.theme.preferredExperienceTypes) {
    if (landmark.interestTags.includes(tag)) score += 8;
  }

  if (landmark.intensity === "high" && day.goals.some((g) => g.type === "keep_energy_low")) {
    score -= 25;
  }
  if (landmark.interestTags.includes("theme-parks")) score -= 40;
  if (landmark.adultPrice > 0 && day.dayBudgetIntent === "free") score -= 10;

  // Beach day support: playground / boardwalk / nearby park complement the shoreline anchor
  if (day.theme.id === "beach") {
    if (isOutdoorPlayground(landmark) || landmark.interestTags.includes("parks")) score += 14;
    if (/\b(boardwalk|pier)\b/i.test(landmark.name)) score += 10;
    // Parks tagged beaches are fine as support — they must not outrank shoreline as anchors
    if (landmark.interestTags.includes("beaches") && /\bpark\b/i.test(landmark.name)) score += 8;
  }

  score += (landmark.name.length % 5) * 0.01;
  return score;
}

export function selectSupportForDay(
  city: CityConfig,
  plan: TripPlan,
  day: DayBlueprint,
  anchor: Landmark,
  opts: SelectSupportOptions,
): Landmark[] {
  const n = maxSupport(day);
  if (n <= 0) return [];

  const radius = clusterRadiusKm(plan);
  const exclude = new Set([
    ...opts.ledgerNames,
    ...opts.alreadyToday.map((l) => l.name),
    anchor.name,
  ]);

  let pool = city.landmarks.filter((l) => !exclude.has(l.name));

  if (day.role === "arrival") {
    const nearStay = pool.filter((l) => {
      const km = stayKm(l, plan);
      return km == null || km <= LOW_FRICTION_STAY_KM;
    });
    if (nearStay.length > 0) pool = nearStay;
  } else {
    const nearby = pool.filter(
      (l) => haversineKm(l.lat, l.lng, anchor.lat, anchor.lng) <= radius * 1.25,
    );
    if (nearby.length > 0) pool = nearby;
  }

  if (opts.visitWindow) {
    const open = pool.filter((l) => isLandmarkOpenForVisit(l, opts.visitWindow!));
    if (open.length > 0) pool = open;
  }

  const ranked = [...pool]
    .map((lm) => ({ lm, score: scoreSupportCandidate(lm, day, plan, anchor) }))
    .sort((a, b) => b.score - a.score || a.lm.name.localeCompare(b.lm.name));

  const picked: Landmark[] = [];
  for (const row of ranked) {
    if (picked.length >= n) break;
    picked.push(row.lm);
    exclude.add(row.lm.name);
  }
  return picked;
}
