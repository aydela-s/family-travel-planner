import type { CityConfig, Landmark, LandmarkInterestTag } from "@/config/city-pricing";
import { clusterRadiusKm } from "@/config/cluster-distances";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { travelDayBudget, travelTimeBudget } from "@/config/travel-times";
import { haversineKm } from "@/lib/maps/directions";
import {
  estimateDurationMin,
  isHighValueAttraction,
  stayTravelMin,
  travelFrictionScore,
} from "@/lib/maps/travel-estimate";
import { getFamilyAgeProfile, landmarkAgeScore } from "@/lib/schedule/family-profile";
import { fitsInDailyLoadBudget } from "@/lib/schedule/activity-load";
import { isLandmarkOpenForVisit, type VisitWindow } from "@/lib/schedule/landmark-hours";
import {
  dayAlreadyHasHeavyLandmark,
  exceedsBudgetStyleTicket,
  fitsBudgetStyle,
  isChillDayCompanion,
  isHeavyDayLandmark,
  isLongShoppingExperience,
  isOutdoorPlayground,
  isThemeParkExperience,
  LOW_FRICTION_PREFERRED_KM,
  LOW_FRICTION_STAY_KM,
  pairingAllowedForDay,
  sharesAnyDayActivityCategory,
  sharesDayActivityCategory,
  sharesHeavyDayLoad,
} from "@/lib/planning-engine/staged/landmark-experience";
import type { DayBlueprint } from "@/lib/planning-engine/staged/types";
import { compileTripConstraints, type TripConstraints } from "@/lib/planning-engine/constraints";
import { isEligibleStop } from "@/lib/planning-engine/staged/eligibility";
import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import type { TripPlan } from "@/types/trip-plan";

export type SelectSupportOptions = {
  visitWindow?: VisitWindow;
  ledgerNames: Set<string>;
  /** Already committed today (anchor + prior support). */
  alreadyToday: Landmark[];
  /** Selected interests with coverage still outstanding — filled before anything else. */
  uncoveredSelectedTags?: LandmarkInterestTag[];
  /** Compiled user constraints; derived from the plan when omitted. */
  constraints?: TripConstraints;
};

function wantsChillCompanion(day: DayBlueprint, anchor: Landmark): boolean {
  return (
    day.theme.id === "theme_park" ||
    day.theme.id === "shopping" ||
    isThemeParkExperience(anchor) ||
    isLongShoppingExperience(anchor)
  );
}

function maxSupport(day: DayBlueprint, anchor?: Landmark): number {
  if (day.role === "departure" || day.role === "recovery") return 0;
  if (anchor && wantsChillCompanion(day, anchor)) {
    return Math.min(1, day.capacity.maxSupportStops);
  }
  const capped = day.constraints.find((c) => c.type === "max_activities");
  if (capped && capped.type === "max_activities" && capped.n <= 1) return 0;
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

/** Museum campuses / large attractions — too heavy as arrival morning support. */
function isMuseumCampus(landmark: Landmark): boolean {
  return landmark.interestTags.includes("museums") || landmark.interestTags.includes("interactive");
}

/** Light arrival support: playground, simple park, beach/boardwalk — not museum campuses. */
function isLightArrivalSupport(landmark: Landmark): boolean {
  if (landmark.adultPrice > 0) return false;
  if (isMuseumCampus(landmark)) return false;
  if (landmark.interestTags.includes("theme-parks") || landmark.interestTags.includes("zoos")) {
    return false;
  }
  return (
    isOutdoorPlayground(landmark) ||
    landmark.interestTags.some((t) => ["parks", "beaches", "nature", "playgrounds"].includes(t))
  );
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
  // FAM-78: travel time is primary; km radius stays as a light comparison fallback.
  if (km <= radius) score += (radius - km) * 2;
  else score -= (km - radius) * 3;
  const hopMin = estimateDurationMin(anchor, landmark, plan);
  score += travelFrictionScore(hopMin, travelTimeBudget(plan), {
    highValue: isHighValueAttraction(landmark),
  }) * 2;

  // Arrival: prefer light near-stay playground / outdoor; avoid museum-scale campuses
  if (day.role === "arrival") {
    const fromStay = stayTravelMin(landmark, plan);
    const fromStayKm = stayKm(landmark, plan);
    const dayBudget = travelDayBudget(plan);
    if (fromStay != null) {
      if (fromStay <= dayBudget.preferredMin) score += 40;
      else if (fromStay <= dayBudget.softMaxMin) score += 8;
      else score -= 45;
    } else if (fromStayKm != null) {
      if (fromStayKm <= LOW_FRICTION_PREFERRED_KM) score += 40;
      else if (fromStayKm <= LOW_FRICTION_STAY_KM) score += 8;
      else score -= 45;
    }
    if (landmark.adultPrice > 0) score -= 30;
    if (landmark.interestTags.includes("theme-parks")) score -= 45;
    if (isMuseumCampus(landmark)) score -= 55;
    if (isOutdoorPlayground(landmark) && !isMuseumCampus(landmark)) score += 45;
    else if (isLightArrivalSupport(landmark)) score += 22;
    if (landmark.intensity === "high") score -= 20;
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

  if (sharesHeavyDayLoad(landmark, anchor)) score -= 120;
  if (exceedsBudgetStyleTicket(landmark, plan.budgetStyle)) score -= 80;

  if (wantsChillCompanion(day, anchor)) {
    if (isChillDayCompanion(landmark)) score += 90;
    else score -= 200;
  } else if (isThemeParkExperience(anchor) || isThemeParkExperience(landmark)) {
    score -= 200;
  }

  // Nap days return home midday: prefer the morning stop near stay so only
  // one activity (usually the afternoon anchor) can be the longer hop.
  if (shouldIncludeNaps(plan) && day.role !== "arrival") {
    const fromStay = stayTravelMin(landmark, plan);
    const dayBudget = travelDayBudget(plan);
    if (fromStay != null) {
      if (fromStay <= dayBudget.preferredMin) score += 48;
      else if (fromStay <= dayBudget.softMaxMin) score += 12;
      else score -= 55;
    } else {
      const fromStayKm = stayKm(landmark, plan);
      if (fromStayKm != null) {
        if (fromStayKm <= LOW_FRICTION_PREFERRED_KM) score += 48;
        else if (fromStayKm <= LOW_FRICTION_STAY_KM) score += 12;
        else score -= 55;
      }
    }
  }

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
  const n = maxSupport(day, anchor);
  if (n <= 0) return [];

  const radius = clusterRadiusKm(plan);
  const exclude = new Set([
    ...opts.ledgerNames,
    ...opts.alreadyToday.map((l) => l.name),
    anchor.name,
  ]);

  // HARD GATE before any scoring: closed venues, enforced age limits, explicit
  // exclusions, and drive limits leave the pool entirely. Support stops are
  // optional, so an empty pool just means a shorter day.
  const eligibilityCtx = {
    plan,
    constraints: opts.constraints ?? compileTripConstraints(plan),
    visitWindow: opts.visitWindow,
  };
  const cityLandmarks = city.landmarks.filter((l) => isEligibleStop(l, eligibilityCtx));

  let pool = cityLandmarks.filter((l) => !exclude.has(l.name));

  // Never stack the same experience category twice on one day (e.g. beach + waterfront playground).
  pool = pool.filter((l) => !sharesDayActivityCategory(l, anchor));
  pool = pool.filter((l) => !sharesAnyDayActivityCategory(l, opts.alreadyToday));
  pool = pool.filter((l) => pairingAllowedForDay(anchor, l));
  pool = pool.filter((l) => fitsBudgetStyle(l, plan.budgetStyle));

  if (wantsChillCompanion(day, anchor)) {
    const chill = pool.filter((l) => isChillDayCompanion(l));
    if (chill.length > 0) pool = chill;
  }

  // Shopping stops only belong on shopping days (and never as arrival companions).
  if (day.theme.id === "shopping") {
    // Mall is the anchor; support must stay low-key (filtered above).
  } else {
    pool = pool.filter((l) => !l.interestTags.includes("shopping"));
  }

  if (day.role === "arrival") {
    // Never use museum campuses as arrival companions — too heavy for travel day.
    pool = pool.filter((l) => !isMuseumCampus(l));
    const dayBudget = travelDayBudget(plan);
    const nearStay = pool.filter((l) => {
      const mins = stayTravelMin(l, plan);
      if (mins != null) return mins <= dayBudget.softMaxMin;
      const km = stayKm(l, plan);
      return km == null || km <= LOW_FRICTION_STAY_KM;
    });
    if (nearStay.length > 0) pool = nearStay;

    const preferredPlay = pool.filter((l) => {
      const mins = stayTravelMin(l, plan);
      const close =
        mins != null
          ? mins <= dayBudget.preferredMin
          : stayKm(l, plan) == null || (stayKm(l, plan) ?? 99) <= LOW_FRICTION_PREFERRED_KM;
      return isOutdoorPlayground(l) && !isMuseumCampus(l) && close;
    });
    if (preferredPlay.length > 0) {
      pool = preferredPlay;
    } else {
      const light = pool.filter((l) => {
        const mins = stayTravelMin(l, plan);
        const close =
          mins != null
            ? mins <= dayBudget.preferredMin
            : stayKm(l, plan) == null || (stayKm(l, plan) ?? 99) <= LOW_FRICTION_PREFERRED_KM;
        return isLightArrivalSupport(l) && close;
      });
      if (light.length > 0) pool = light;
      else {
        const lightWider = pool.filter(isLightArrivalSupport);
        if (lightWider.length > 0) pool = lightWider;
      }
    }
  } else if (shouldIncludeNaps(plan)) {
    // Nap hub: morning support stays near home; afternoon anchor may be the far hop.
    const dayBudget = travelDayBudget(plan);
    const nearStay = pool.filter((l) => {
      const mins = stayTravelMin(l, plan);
      if (mins != null) return mins <= dayBudget.softMaxMin;
      const km = stayKm(l, plan);
      return km == null || km <= LOW_FRICTION_STAY_KM;
    });
    if (nearStay.length > 0) pool = nearStay;
  } else {
    const budget = travelTimeBudget(plan);
    const nearby = pool.filter(
      (l) => estimateDurationMin(anchor, l, plan) <= budget.softMaxMin,
    );
    if (nearby.length > 0) pool = nearby;
    else {
      const wider = pool.filter(
        (l) => estimateDurationMin(anchor, l, plan) <= Math.round(budget.softMaxMin * 1.25),
      );
      if (wider.length > 0) pool = wider;
      else {
        const kmNearby = pool.filter(
          (l) => haversineKm(l.lat, l.lng, anchor.lat, anchor.lng) <= radius * 1.25,
        );
        if (kmNearby.length > 0) pool = kmNearby;
      }
    }
  }

  if (opts.visitWindow) {
    const open = pool.filter((l) => isLandmarkOpenForVisit(l, opts.visitWindow!));
    if (open.length > 0) pool = open;
  }

  // Selected interests are the priority: an unselected category is only used
  // once no selected-interest candidate survives the gates in the loop below,
  // so this ranks tiers instead of discarding the lower ones outright.
  const selected = new Set(interestTagsFromPlan(plan.interests));
  const uncovered = new Set(opts.uncoveredSelectedTags ?? []);
  const interestTier = (l: Landmark): number => {
    if (uncovered.size > 0 && l.interestTags.some((t) => uncovered.has(t))) return 0;
    if (selected.size > 0 && l.interestTags.some((t) => selected.has(t))) return 1;
    return 2;
  };

  const ranked = [...pool]
    .map((lm) => ({ lm, score: scoreSupportCandidate(lm, day, plan, anchor) }))
    .sort(
      (a, b) =>
        interestTier(a.lm) - interestTier(b.lm) ||
        b.score - a.score ||
        a.lm.name.localeCompare(b.lm.name),
    );

  const cityStillHasUncovered = (): boolean =>
    uncovered.size > 0 &&
    cityLandmarks.some(
      (l) =>
        !exclude.has(l.name) &&
        l.interestTags.some((t) => uncovered.has(t)) &&
        !sharesAnyDayActivityCategory(l, [anchor]),
    );

  const picked: Landmark[] = [];
  for (const row of ranked) {
    if (picked.length >= n) break;
    if (sharesAnyDayActivityCategory(row.lm, [anchor, ...picked])) continue;
    if (!pairingAllowedForDay(anchor, row.lm)) continue;
    if (picked.some((p) => !pairingAllowedForDay(p, row.lm))) continue;
    if (dayAlreadyHasHeavyLandmark([anchor, ...picked]) && isHeavyDayLandmark(row.lm)) continue;
    if (!fitsBudgetStyle(row.lm, plan.budgetStyle)) continue;

    const coversUncovered =
      uncovered.size > 0 && row.lm.interestTags.some((t) => uncovered.has(t));
    const isOffInterest =
      selected.size > 0 && !row.lm.interestTags.some((t) => selected.has(t));
    // HARD RULE: never schedule an unselected interest while a selected one is
    // still uncovered and has an unused candidate in the city.
    if (isOffInterest && cityStillHasUncovered()) continue;

    // Arrival light playground companions stay exempt — they are deliberately near-stay fillers.
    // Uncovered selected interests also skip the load gate so coverage is not abandoned.
    const skipLoadGate =
      coversUncovered ||
      (day.role === "arrival" && isLightArrivalSupport(row.lm)) ||
      (wantsChillCompanion(day, anchor) && isChillDayCompanion(row.lm));
    if (!skipLoadGate) {
      const hopMin = estimateDurationMin(
        picked.length > 0 ? picked[picked.length - 1]! : anchor,
        row.lm,
        plan,
      );
      if (
        !fitsInDailyLoadBudget([anchor, ...picked], row.lm, plan, {
          travelMinBefore: hopMin,
        })
      ) {
        continue;
      }
    }
    picked.push(row.lm);
    exclude.add(row.lm.name);
  }
  return picked;
}
