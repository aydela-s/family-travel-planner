import type { CityConfig, Landmark, LandmarkInterestTag } from "@/config/city-pricing";
import { clusterRadiusKm } from "@/config/cluster-distances";
import { travelDayBudget, travelTimeBudget } from "@/config/travel-times";
import { haversineKm } from "@/lib/maps/directions";
import {
  estimateDurationMin,
  isHighValueAttraction,
  stayTravelMin,
  travelFrictionScore,
} from "@/lib/maps/travel-estimate";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { getFamilyAgeProfile, landmarkAgeScore } from "@/lib/schedule/family-profile";
import { isLandmarkOpenForVisit, type VisitWindow } from "@/lib/schedule/landmark-hours";
import { shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import {
  compileTripConstraints,
  describeHardConstraint,
  type TripConstraints,
} from "@/lib/planning-engine/constraints";
import { recordConflict, type PlannerConflict } from "@/lib/planning-engine/conflicts";
import {
  isEligibleStop,
  splitEligibleStops,
  type StopRejection,
} from "@/lib/planning-engine/staged/eligibility";
import {
  exceedsBudgetStyleTicket,
  fitsBudgetStyle,
  hasFixedOpeningHours,
  hasTicketRequirement,
  isHeavyDayLandmark,
  isIndoorPlayExperience,
  isOutdoorPlayground,
  isShorelineBeachExperience,
  isBeachThemeAnchor,
  isFamilyWaterPlayExperience,
  isThemeParkExperience,
  LOW_FRICTION_PREFERRED_KM,
  LOW_FRICTION_STAY_KM,
  pairingAllowedForDay,
  sharesAnyDayActivityCategory,
} from "@/lib/planning-engine/staged/landmark-experience";
import type {
  CommittedStop,
  DayBlueprint,
  DayConstraint,
} from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";

function stayKm(landmark: Landmark, plan: TripPlan): number | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return haversineKm(landmark.lat, landmark.lng, plan.stayLat, plan.stayLng);
}

/** City pool with every hard-rule violation removed (see staged/eligibility). */
function eligibleCityLandmarks(
  city: CityConfig,
  plan: TripPlan,
  visitWindow?: VisitWindow,
  constraints?: TripConstraints,
): Landmark[] {
  const ctx = {
    plan,
    visitWindow,
    constraints: constraints ?? compileTripConstraints(plan),
  };
  return city.landmarks.filter((l) => isEligibleStop(l, ctx));
}

function hasConstraint(day: DayBlueprint, type: DayConstraint["type"]): boolean {
  return day.constraints.some((c) => c.type === type);
}

function discourageTags(day: DayBlueprint): LandmarkInterestTag[] {
  const tags: LandmarkInterestTag[] = [];
  for (const c of day.constraints) {
    if (c.type === "discourage_anchor_tags") tags.push(...c.tags);
  }
  return tags;
}

function requiredAnchorTags(day: DayBlueprint): {
  tags: LandmarkInterestTag[];
  mode: "any" | "all";
} | null {
  const c = day.constraints.find((x) => x.type === "anchor_primary_tags");
  if (!c || c.type !== "anchor_primary_tags") return null;
  return { tags: c.tags, mode: c.mode };
}

function matchesRequiredTags(
  landmark: Landmark,
  req: { tags: LandmarkInterestTag[]; mode: "any" | "all" },
): boolean {
  if (req.mode === "all") return req.tags.every((t) => landmark.interestTags.includes(t));
  return req.tags.some((t) => landmark.interestTags.includes(t));
}

function isHighRiskTimeSensitive(landmark: Landmark): boolean {
  return (
    landmark.interestTags.includes("theme-parks") ||
    landmark.intensity === "high" ||
    Boolean(landmark.hoursByWeekday && Object.keys(landmark.hoursByWeekday).length > 0)
  );
}

function isIndoorPaid(landmark: Landmark): boolean {
  return Boolean(landmark.indoor && landmark.adultPrice > 0);
}

function isFlexibleOutdoor(landmark: Landmark): boolean {
  return (
    !landmark.indoor &&
    landmark.adultPrice <= 0 &&
    landmark.interestTags.some((t) =>
      ["beaches", "parks", "nature", "playgrounds"].includes(t),
    )
  );
}

function farLimits(day: DayBlueprint, plan: TripPlan): { maxKm: number; maxMin: number; preferredMin: number } {
  const far = day.constraints.find((c) => c.type === "avoid_far_attractions");
  const travelDay = day.role === "arrival" || day.role === "departure";
  const budget = travelDay ? travelDayBudget(plan) : travelTimeBudget(plan);
  const maxMin = far && far.type === "avoid_far_attractions" ? far.maxMin : budget.softMaxMin;
  const preferredMin = travelDay ? budget.preferredMin : budget.preferredMin;
  const maxKm = far && far.type === "avoid_far_attractions" ? far.maxKm : LOW_FRICTION_STAY_KM;
  return { maxKm, maxMin, preferredMin };
}

/** Time-first stay score; km is a comparison fallback when coords exist. */
function scoreStayProximity(
  durationMin: number | null,
  km: number | null,
  preferredMin: number,
  maxMin: number,
): number {
  if (durationMin != null) {
    if (durationMin <= preferredMin) return 70 - durationMin * 0.8;
    if (durationMin <= maxMin) return 28 - (durationMin - preferredMin) * 1.2;
    return -70 - (durationMin - maxMin) * 2.5;
  }
  if (km == null) return 0;
  if (km <= LOW_FRICTION_PREFERRED_KM) return 70 - km * 2;
  if (km <= LOW_FRICTION_STAY_KM) return 28 - (km - LOW_FRICTION_PREFERRED_KM) * 3;
  return -70 - (km - LOW_FRICTION_STAY_KM) * 5;
}

function isLowWalkingFriendly(landmark: Landmark): boolean {
  return landmark.intensity === "low" || landmark.intensity === "medium";
}

/** Soft filters — candidates must pass hard ledger exclusion + required tags when present. */
export function filterAnchorCandidates(
  city: CityConfig,
  day: DayBlueprint,
  plan: TripPlan,
  ledgerNames: Set<string>,
  visitWindow?: VisitWindow,
  priorFullDayAnchors: Set<string> = new Set(),
  constraints?: TripConstraints,
): Landmark[] {
  // HARD GATE first: closed venues, enforced age limits, and explicit user
  // exclusions / drive limits are removed before any soft preference runs.
  const cityLandmarks = eligibleCityLandmarks(city, plan, visitWindow, constraints);
  const unused = cityLandmarks.filter((l) => !ledgerNames.has(l.name));
  const notPriorFullAnchor = cityLandmarks.filter((l) => !priorFullDayAnchors.has(l.name));
  // Full days: never reopen a prior full-day anchor while any other landmark exists.
  // Prefer unused. HARD RULE: never recycle a used landmark onto another day.
  let pool: Landmark[];
  if (unused.length > 0) {
    pool = unused;
  } else if (day.role === "arrival" || day.role === "departure") {
    // Travel days with nothing left unused: leave the pool empty so the
    // low-friction fallback can pick a free near-stay stop that still isn't
    // on the ledger when possible; otherwise the last resort below runs.
    pool = [];
  } else if (notPriorFullAnchor.length > 0) {
    pool = notPriorFullAnchor.filter((l) => !ledgerNames.has(l.name));
  } else {
    pool = [];
  }

  const req = requiredAnchorTags(day);
  if (req) {
    const matching = pool.filter((l) => matchesRequiredTags(l, req));
    if (matching.length > 0) pool = matching;
  }

  // Beach theme: shoreline / ocean experience must beat bay parks when available
  if (hasConstraint(day, "prefer_shoreline_beach_anchor") || day.theme.id === "beach") {
    const water = pool.filter(isBeachThemeAnchor);
    if (water.length > 0) pool = water;
  }

  // Indoor play vs outdoor playgrounds — do not mix coverage buckets
  if (day.theme.id === "play_indoor") {
    const indoor = pool.filter(isIndoorPlayExperience);
    if (indoor.length > 0) pool = indoor;
  }
  if (day.theme.id === "playgrounds") {
    const outdoor = pool.filter(isOutdoorPlayground);
    if (outdoor.length > 0) {
      pool = outdoor;
    } else {
      // Never fill a Playground Day with soft-play / indoor adventure centers.
      const parks = pool.filter(
        (l) => l.interestTags.includes("parks") && !isIndoorPlayExperience(l),
      );
      if (parks.length > 0) pool = parks;
      else pool = pool.filter((l) => !isIndoorPlayExperience(l));
    }
  }

  // Shopping only on shopping-themed days — never as filler on mix / museum days.
  if (day.theme.id === "shopping") {
    const malls = pool.filter((l) => l.interestTags.includes("shopping"));
    if (malls.length > 0) pool = malls;
  } else {
    pool = pool.filter((l) => !l.interestTags.includes("shopping"));
  }

  // Preferred experience types (soft pre-filter when enough options)
  const preferred = day.theme.preferredExperienceTypes;
  if (preferred.length > 0) {
    const pref = pool.filter((l) => l.interestTags.some((t) => preferred.includes(t)));
    if (pref.length >= 2) pool = pref;
  }

  if (visitWindow) {
    const open = pool.filter((l) => isLandmarkOpenForVisit(l, visitWindow));
    if (open.length > 0) pool = open;
  }

  // Arrival/departure: prefer free flexible outdoor near stay when options exist
  if (day.role === "arrival" || day.role === "departure") {
    // Easy exit / travel days never use theme parks, soft-play, or shopping malls.
    pool = pool.filter(
      (l) =>
        !isThemeParkExperience(l) &&
        !l.interestTags.includes("theme-parks") &&
        !l.interestTags.includes("shopping") &&
        !isIndoorPlayExperience(l),
    );
    // HARD RULE: never reuse a landmark already used on this trip. Prefer an
    // empty local pool over recycling Play Street Museum (or any stop) again.
    if (unused.length > 0) {
      const unusedOnly = pool.filter((l) => !ledgerNames.has(l.name));
      if (unusedOnly.length > 0) pool = unusedOnly;
      else {
        // No unused stop inside the travel-day filters — still refuse reuse.
        pool = unused.filter(
          (l) =>
            !isThemeParkExperience(l) &&
            !l.interestTags.includes("theme-parks") &&
            !l.interestTags.includes("shopping") &&
            !isIndoorPlayExperience(l),
        );
      }
    }
    const { maxKm, maxMin, preferredMin } = farLimits(day, plan);
    const isNear = (l: Landmark) => {
      const km = stayKm(l, plan);
      if (km != null && km > maxKm) return false;
      const mins = stayTravelMin(l, plan);
      if (mins != null) return mins <= maxMin;
      return km == null || km <= maxKm;
    };

    // Prefer unused near-stay landmarks; never fall back to reusing a prior stop.
    let nearPool = unused.filter(isNear);
    const unusedFree = nearPool.filter(
      (l) =>
        l.adultPrice <= 0 &&
        !l.interestTags.includes("theme-parks") &&
        !isIndoorPlayExperience(l),
    );
    if (unusedFree.length > 0) {
      nearPool = unusedFree;
    } else if (nearPool.length === 0) {
      nearPool = unused.filter(
        (l) => isNear(l) && !isIndoorPlayExperience(l) && !isThemeParkExperience(l),
      );
    }
    if (nearPool.length > 0) pool = nearPool;

    const nearPreferred = pool.filter((l) => {
      const mins = stayTravelMin(l, plan);
      if (mins != null) return mins <= preferredMin;
      const km = stayKm(l, plan);
      return km == null || km <= LOW_FRICTION_PREFERRED_KM;
    });
    if (nearPreferred.length > 0) pool = nearPreferred;

    const freeFlex = pool.filter(
      (l) => !hasTicketRequirement(l) && (isFlexibleOutdoor(l) || l.adultPrice <= 0),
    );
    if (freeFlex.length > 0) pool = freeFlex;

    // Parks/playgrounds beat scenic beaches when both are near stay
    const easyLocal = pool.filter(
      (l) => isOutdoorPlayground(l) || l.interestTags.includes("parks"),
    );
    if (easyLocal.length > 0) pool = easyLocal;
  } else if (hasConstraint(day, "prefer_free_anchor") || day.dayBudgetIntent === "free") {
    const free = pool.filter((l) => l.adultPrice <= 0);
    if (free.length > 0) pool = free;
  } else if (hasConstraint(day, "prefer_paid_anchor") || day.dayBudgetIntent === "paid") {
    const paid = pool.filter((l) => l.adultPrice > 0);
    if (paid.length > 0) pool = paid;
  }

  if (hasConstraint(day, "prefer_recovery_outdoor")) {
    const outdoor = pool.filter(
      (l) =>
        !l.indoor &&
        l.interestTags.some((t) =>
          ["beaches", "nature", "parks", "playgrounds"].includes(t),
        ),
    );
    if (outdoor.length > 0) pool = outdoor;
  }

  if ((plan.budgetStyle || "balanced") !== "splurge") {
    const affordable = pool.filter((l) => fitsBudgetStyle(l, plan.budgetStyle));
    if (affordable.length > 0) pool = affordable;
  }

  return pool;
}

export function scoreAnchorCandidate(
  landmark: Landmark,
  day: DayBlueprint,
  plan: TripPlan,
  ledgerNames: Set<string>,
): number {
  const profile = getFamilyAgeProfile(plan);
  const km = stayKm(landmark, plan);
  const lowFrictionDay = day.role === "arrival" || day.role === "departure";
  // Arrival/departure: proximity beats perfect age coverage (Waterfront vs Coronado).
  const ageWeight = lowFrictionDay ? 0.25 : 1;
  let score = 40 + landmarkAgeScore(landmark, profile) * ageWeight;

  if (km != null && typeof plan.stayLat === "number" && typeof plan.stayLng === "number") {
    const fromStay = estimateDurationMin(
      { lat: plan.stayLat, lng: plan.stayLng },
      landmark,
      plan,
    );
    score += travelFrictionScore(fromStay, travelTimeBudget(plan), {
      highValue: isHighValueAttraction(landmark),
    });
  }

  const req = requiredAnchorTags(day);
  if (req && matchesRequiredTags(landmark, req)) score += 50;
  else if (req) score -= 40;

  for (const tag of day.theme.preferredExperienceTypes) {
    if (landmark.interestTags.includes(tag)) score += lowFrictionDay ? 8 : 12;
  }

  const discouraged = discourageTags(day);
  if (landmark.interestTags.some((t) => discouraged.includes(t))) score -= 35;

  if (hasConstraint(day, "discourage_indoor_paid_anchor") && isIndoorPaid(landmark)) {
    score -= 45;
  }

  if (hasConstraint(day, "avoid_high_risk_time_sensitive_anchor") && isHighRiskTimeSensitive(landmark)) {
    score -= 40;
  }

  // Beach-first: shoreline / aquatic anchors win; bay/park beaches lose hard
  if (hasConstraint(day, "prefer_shoreline_beach_anchor") || day.theme.id === "beach") {
    if (isShorelineBeachExperience(landmark)) score += 55;
    else if (isFamilyWaterPlayExperience(landmark)) score += 50;
    else if (landmark.interestTags.includes("beaches") && /\bpark\b/i.test(landmark.name)) {
      score -= 50;
    } else if (!landmark.interestTags.includes("beaches") && !isFamilyWaterPlayExperience(landmark)) {
      score -= 30;
    }
  }

  if (day.theme.id === "play_indoor") {
    if (isIndoorPlayExperience(landmark)) score += 45;
    else if (isOutdoorPlayground(landmark)) score -= 50;
  }
  if (day.theme.id === "playgrounds") {
    if (isOutdoorPlayground(landmark)) score += 45;
    else if (isIndoorPlayExperience(landmark)) score -= 50;
  }

  const { maxKm, maxMin, preferredMin } = farLimits(day, plan);
  const stayMin = stayTravelMin(landmark, plan);

  if (day.theme.id === "play_indoor") {
    // Prefer neighborhood soft-play over a 30+ min drive across the metro.
    if (stayMin != null) {
      if (stayMin <= 15) score += 35;
      else if (stayMin <= 25) score += 10;
      else score -= Math.min(80, (stayMin - 25) * 3);
    } else if (km != null) {
      if (km <= 8) score += 25;
      else if (km > 20) score -= Math.min(80, (km - 20) * 2);
    }
  }
  if (day.theme.id === "playgrounds") {
    if (stayMin != null) {
      if (stayMin <= 15) score += 30;
      else if (stayMin > 25) score -= Math.min(60, (stayMin - 25) * 2);
    }
  }

  if (lowFrictionDay) {
    // Priority: 1 near stay → 2 free/flexible → 3 low walking → 4 scenic only if close
    score += scoreStayProximity(stayMin, km, preferredMin, maxMin);

    if (hasTicketRequirement(landmark) || landmark.adultPrice > 0) {
      // Departure: paid only when very close; arrival: always steep
      const closePaid =
        stayMin != null ? stayMin <= preferredMin : km != null && km <= LOW_FRICTION_PREFERRED_KM;
      if (day.role === "departure" && closePaid) {
        score -= 45;
      } else {
        score -= 70;
      }
    } else {
      score += 28;
    }

    if (hasConstraint(day, "avoid_paid_tickets") && hasTicketRequirement(landmark)) {
      score -= 40;
    }

    if (
      hasConstraint(day, "avoid_fixed_time_experiences") &&
      (hasFixedOpeningHours(landmark) || isHighRiskTimeSensitive(landmark))
    ) {
      // Flexible outdoor parks/playgrounds often list hours but are low-risk
      if (isFlexibleOutdoor(landmark) && !hasTicketRequirement(landmark)) {
        score -= 5;
      } else {
        score -= 50;
      }
    }

    if (hasConstraint(day, "prefer_low_walking") || day.goals.some((g) => g.type === "low_friction")) {
      if (landmark.intensity === "low") score += 22;
      if (landmark.intensity === "medium") score += 6;
      if (landmark.intensity === "high") score -= 35;
      if (!isLowWalkingFriendly(landmark)) score -= 15;
    }

    // Near-stay parks/playgrounds beat scenic beaches that require a longer drive
    if (
      (stayMin != null ? stayMin <= preferredMin : km != null && km <= LOW_FRICTION_PREFERRED_KM) &&
      (isOutdoorPlayground(landmark) || landmark.interestTags.includes("parks"))
    ) {
      score += 45;
    }

    // Scenic / nature / beach bonus only when geographically close — never overrides near-stay
    if (landmark.interestTags.some((t) => ["nature", "beaches"].includes(t))) {
      if (stayMin != null) {
        if (stayMin <= preferredMin) score += 10;
        else if (stayMin <= maxMin) score += 2;
        else score -= 30;
      } else if (km != null && km <= LOW_FRICTION_PREFERRED_KM) score += 10;
      else if (km != null && km <= maxKm) score += 2;
      else if (km != null && km > maxKm) score -= 30;
    }

    if (isFlexibleOutdoor(landmark)) score += 20;

    // Indoor paid / aquariums / zoos are high-friction on travel days
    if (landmark.interestTags.some((t) => ["zoos", "museums", "interactive"].includes(t))) {
      score -= 40;
    }
    if (landmark.indoor && hasTicketRequirement(landmark)) score -= 35;
  } else if (hasConstraint(day, "avoid_far_attractions")) {
    if (stayMin != null) {
      if (stayMin > maxMin) score -= 40;
      else score += Math.max(0, 18 - stayMin * 0.4);
    } else if (km != null) {
      if (km > maxKm) score -= 40;
      else score += Math.max(0, 15 - km);
    }
  }

  for (const g of day.goals) {
    if (g.type === "prefer_near_stay_or_flexible_outdoor" && !lowFrictionDay) {
      if (stayMin != null) {
        if (stayMin <= g.maxMin) score += 18;
        else if (isFlexibleOutdoor(landmark)) score += 8;
        else score -= 12;
      } else if (km != null) {
        if (km <= g.maxKm) score += 18;
        else if (isFlexibleOutdoor(landmark)) score += 8;
        else score -= 12;
      }
    }
    if (g.type === "dedicated_experience" && landmark.interestTags.includes(g.tag)) {
      score += 28;
    }
    if (g.type === "keep_energy_low" || g.type === "low_friction" || g.type === "easy_exit") {
      if (landmark.intensity === "low") score += 14;
      if (landmark.intensity === "high") score -= 20;
    }
    if (g.type === "include_older_appeal") {
      if (
        landmark.interestTags.some((t) =>
          ["history", "interactive", "food-markets", "nature", "beaches", "entertainment"].includes(
            t,
          ),
        )
      ) {
        score += 16;
      }
    }
  }

  if (day.dayBudgetIntent === "paid" && landmark.adultPrice > 0) score += 10;
  if (day.dayBudgetIntent === "free" && landmark.adultPrice <= 0) score += 10;

  if (exceedsBudgetStyleTicket(landmark, plan.budgetStyle)) score -= 120;

  if (isHeavyDayLandmark(landmark) && day.goals.some((g) => g.type === "keep_energy_low")) {
    score -= 35;
  }

  if (isThemeParkExperience(landmark) && day.role === "full") {
    score += 18;
  }

  // Arrival/departure may soft-reuse near-stay POIs when the local unused pool is empty.
  if (ledgerNames.has(landmark.name)) score -= 5000;

  // Tiny deterministic jitter from name for stable ties
  score += (landmark.name.length % 7) * 0.01;

  return score;
}

export function toCommittedStop(landmark: Landmark, role: "anchor" | "support"): CommittedStop {
  return {
    landmarkName: landmark.name,
    placeId: landmark.placeId,
    role,
    interestTags: landmark.interestTags,
    isPaid: landmark.adultPrice > 0,
  };
}

export type SelectAnchorOptions = {
  visitWindow?: VisitWindow;
  ledgerNames: Set<string>;
  /** Soft-exclude landmarks (e.g. toddler-only when rebalancing mixed families). */
  softExcludeNames?: Set<string>;
  /** Full-day anchors already used this trip — hard-avoid while alternatives exist. */
  priorFullDayAnchors?: Set<string>;
  /** Compiled user constraints; derived from the plan when omitted. */
  constraints?: TripConstraints;
  /** Sink for hard rules that could not be satisfied. */
  conflicts?: PlannerConflict[];
};

/** Last-resort near-stay pick for arrival/departure — never leave the low-friction ring. */
function lowFrictionFallback(
  candidates: Landmark[],
  plan: TripPlan,
  day: DayBlueprint,
): Landmark | null {
  const { maxKm, maxMin } = farLimits(day, plan);

  const near = candidates
    .filter((l) => {
      const km = stayKm(l, plan);
      if (km != null && km > maxKm) return false;
      const mins = stayTravelMin(l, plan);
      if (mins != null && mins > maxMin) return false;
      if (l.adultPrice > 0) return false;
      if (l.interestTags.includes("theme-parks")) return false;
      if (isIndoorPlayExperience(l)) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = stayTravelMin(a, plan) ?? 99;
      const tb = stayTravelMin(b, plan) ?? 99;
      const ka = stayKm(a, plan) ?? 99;
      const kb = stayKm(b, plan) ?? 99;
      return (
        ta - tb ||
        ka - kb ||
        Number(isOutdoorPlayground(b)) - Number(isOutdoorPlayground(a)) ||
        a.name.localeCompare(b.name)
      );
    });

  return near[0] ?? null;
}

const CONFLICT_CODE_BY_RULE: Record<StopRejection["rule"], PlannerConflict["code"]> = {
  venue_closed: "no_open_venue",
  age_restriction: "no_age_appropriate_venue",
  exclude_venue: "exclusion_leaves_nothing",
  exclude_interest: "exclusion_leaves_nothing",
  max_drive_min: "drive_limit_exceeded",
  no_naps: "exclusion_leaves_nothing",
  dietary_required: "dietary_unreachable",
};

/**
 * Every candidate breaks a hard rule but the day still needs an anchor. Take the
 * best-scoring one and publish the whole trade-off, so the violation is visible
 * in the conflict data instead of silently shipping as a normal pick.
 */
function anchorViolatingFallback(
  city: CityConfig,
  plan: TripPlan,
  day: DayBlueprint,
  rejected: Array<{ landmark: Landmark; rejection: StopRejection }>,
  opts: SelectAnchorOptions,
): Landmark {
  const ranked = [...rejected].sort(
    (a, b) =>
      scoreAnchorCandidate(b.landmark, day, plan, opts.ledgerNames) -
        scoreAnchorCandidate(a.landmark, day, plan, opts.ledgerNames) ||
      a.landmark.name.localeCompare(b.landmark.name),
  );
  const fallback = ranked[0];
  if (!fallback) return city.landmarks[0]!;

  const options = ranked.slice(0, 4).map(({ landmark, rejection }) => ({
    kind: "venue" as const,
    name: landmark.name,
    placeId: landmark.placeId,
    violates: [rejection.rule],
    reason: rejection.reason,
  }));

  recordConflict(opts.conflicts, {
    code: CONFLICT_CODE_BY_RULE[fallback.rejection.rule],
    rule: fallback.rejection.rule,
    constraint: fallback.rejection.constraint,
    scope: { day: day.dayIndex, slot: "anchor" },
    message: fallback.rejection.constraint
      ? `Day ${day.dayIndex}: no activity satisfies "${describeHardConstraint(fallback.rejection.constraint)}".`
      : `Day ${day.dayIndex}: no activity is available that meets every requirement.`,
    options,
    chosen: options[0],
  });

  return fallback.landmark;
}

/** Pick the day's hero stop from a small filtered candidate set. */
export function selectAnchorForDay(
  city: CityConfig,
  plan: TripPlan,
  day: DayBlueprint,
  opts: SelectAnchorOptions,
): Landmark {
  const constraints = opts.constraints ?? compileTripConstraints(plan);
  const eligibility = splitEligibleStops(city.landmarks, {
    plan,
    constraints,
    visitWindow: opts.visitWindow,
  });
  let candidates = filterAnchorCandidates(
    city,
    day,
    plan,
    opts.ledgerNames,
    opts.visitWindow,
    opts.priorFullDayAnchors,
    constraints,
  );
  if (opts.softExcludeNames && opts.softExcludeNames.size > 0) {
    const filtered = candidates.filter((l) => !opts.softExcludeNames!.has(l.name));
    if (filtered.length > 0) candidates = filtered;
  }
  if (candidates.length === 0) {
    if (day.role === "arrival" || day.role === "departure") {
      const near = lowFrictionFallback(eligibility.eligible, plan, day);
      if (near) return near;
    }
    const prior = opts.priorFullDayAnchors ?? new Set<string>();
    const travelDay = day.role === "arrival" || day.role === "departure";
    const eligible = (l: Landmark) =>
      !travelDay || (!isIndoorPlayExperience(l) && !isThemeParkExperience(l));
    const cityLandmarks = eligibility.eligible;
    const unusedAny = cityLandmarks.filter(
      (l) => !opts.ledgerNames.has(l.name) && eligible(l),
    );
    const notPriorAnchor = cityLandmarks.filter((l) => !prior.has(l.name) && eligible(l));
    const pool =
      unusedAny.length > 0
        ? unusedAny
        : notPriorAnchor.length > 0
          ? notPriorAnchor
          : travelDay
            ? cityLandmarks.filter(eligible)
            : notPriorAnchor;
    if (pool.length === 0) {
      // Nothing in the city satisfies the hard rules. The day still needs a hero
      // stop, so record exactly what was rejected and mark the fallback as a
      // known violation rather than passing it off as a valid pick.
      return anchorViolatingFallback(city, plan, day, eligibility.rejected, opts);
    }
    const ranked = [...pool]
      .map((lm) => ({
        lm,
        score: scoreAnchorCandidate(lm, day, plan, opts.ledgerNames),
      }))
      .sort((a, b) => b.score - a.score || a.lm.name.localeCompare(b.lm.name));
    return ranked[0]!.lm;
  }

  const ranked = [...candidates]
    .map((lm) => ({
      lm,
      score: scoreAnchorCandidate(lm, day, plan, opts.ledgerNames),
    }))
    .sort((a, b) => b.score - a.score || a.lm.name.localeCompare(b.lm.name));

  return ranked[0]!.lm;
}

export type SoftFillerOptions = {
  /** Selected interests with coverage still outstanding — filled first. */
  uncoveredSelectedTags?: LandmarkInterestTag[];
  constraints?: TripConstraints;
};

/** Soft near-stay / outdoor filler when no support stop is available. */
export function selectSoftFiller(
  city: CityConfig,
  plan: TripPlan,
  day: DayBlueprint,
  anchor: Landmark,
  ledgerNames: Set<string>,
  visitWindow?: VisitWindow,
  alreadyToday: Landmark[] = [],
  opts: SoftFillerOptions = {},
): Landmark | null {
  if (isThemeParkExperience(anchor) || day.theme.id === "theme_park") return null;
  const today = alreadyToday.length > 0 ? alreadyToday : [anchor];
  const radius = clusterRadiusKm(plan);
  const budget = travelTimeBudget(plan);
  const dayBudget = travelDayBudget(plan);
  const exclude = new Set([...ledgerNames, anchor.name, ...today.map((l) => l.name)]);
  const selected = new Set(interestTagsFromPlan(plan.interests));
  // HARD GATE — a filler is optional, so a rule violation simply means no filler.
  const cityLandmarks = eligibleCityLandmarks(city, plan, visitWindow, opts.constraints);
  let pool = cityLandmarks.filter(
    (l) =>
      !exclude.has(l.name) &&
      l.intensity !== "high" &&
      !l.interestTags.includes("theme-parks") &&
      !l.interestTags.includes("shopping") &&
      !sharesAnyDayActivityCategory(l, today) &&
      pairingAllowedForDay(anchor, l) &&
      today.every((t) => pairingAllowedForDay(t, l)) &&
      fitsBudgetStyle(l, plan.budgetStyle),
  );

  if (shouldIncludeNaps(plan)) {
    const nearStay = pool.filter((l) => {
      const mins = stayTravelMin(l, plan);
      if (mins != null) return mins <= dayBudget.softMaxMin;
      const km = stayKm(l, plan);
      return km == null || km <= LOW_FRICTION_STAY_KM;
    });
    if (nearStay.length > 0) pool = nearStay;
  } else {
    pool = pool.filter(
      (l) => estimateDurationMin(anchor, l, plan) <= Math.round(budget.softMaxMin * 1.25),
    );
    if (pool.length === 0) {
      pool = cityLandmarks.filter(
        (l) =>
          !exclude.has(l.name) &&
          l.intensity !== "high" &&
          !l.interestTags.includes("theme-parks") &&
          !sharesAnyDayActivityCategory(l, today) &&
          pairingAllowedForDay(anchor, l) &&
          fitsBudgetStyle(l, plan.budgetStyle) &&
          haversineKm(l.lat, l.lng, anchor.lat, anchor.lng) <= radius,
      );
    }
  }
  if (visitWindow) {
    const open = pool.filter((l) => isLandmarkOpenForVisit(l, visitWindow));
    if (open.length > 0) pool = open;
  }

  // Selected interests come first, and an interest the trip hasn't covered yet
  // beats one it already has. An unselected category (e.g. a city park when only
  // Nature was chosen) is only allowed when no selected interest has a candidate.
  if (pool.length === 0) return null;

  const uncovered = new Set(opts.uncoveredSelectedTags ?? []);
  if (uncovered.size > 0) {
    const uncoveredInCity = cityLandmarks.filter(
      (l) =>
        !exclude.has(l.name) &&
        l.interestTags.some((t) => uncovered.has(t)) &&
        !sharesAnyDayActivityCategory(l, today) &&
        pairingAllowedForDay(anchor, l) &&
        today.every((t) => pairingAllowedForDay(t, l)),
    );
    if (uncoveredInCity.length > 0) {
      const inPool = pool.filter((l) => uncoveredInCity.some((u) => u.name === l.name));
      pool = inPool.length > 0 ? inPool : uncoveredInCity;
    }
  }

  const interestTier = (l: Landmark): number => {
    if (uncovered.size > 0 && l.interestTags.some((t) => uncovered.has(t))) return 0;
    if (selected.size > 0 && l.interestTags.some((t) => selected.has(t))) return 1;
    return 2;
  };

  const profile = getFamilyAgeProfile(plan);
  const fillerScore = (l: Landmark) =>
    l.interestTags.filter((t) => uncovered.has(t)).length * 40 +
    l.interestTags.filter((t) => selected.has(t)).length * 30 +
    landmarkAgeScore(l, profile);
  return [...pool].sort(
    (a, b) =>
      interestTier(a) - interestTier(b) ||
      fillerScore(b) - fillerScore(a) ||
      a.adultPrice - b.adultPrice,
  )[0]!;
}
