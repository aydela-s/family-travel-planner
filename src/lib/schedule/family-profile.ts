import { CityConfig, Landmark, LandmarkAgeTag, LandmarkIntensity } from "@/config/city-pricing";
import { haversineKm } from "@/lib/maps/directions";
import { landmarksForStyle } from "@/lib/pricing/budget-style";
import { interestTagsFromPlan } from "@/lib/schedule/interest-map";
import { isLandmarkOpenForVisit, VisitWindow } from "@/lib/schedule/landmark-hours";
import { TripPlan } from "@/types/trip-plan";

export type { VisitWindow };

export type FamilyAgeProfile = {
  youngest: number | null;
  oldest: number | null;
  hasToddler: boolean;
  hasYoungChild: boolean;
  hasTween: boolean;
  hasTeen: boolean;
  isMixedAges: boolean;
  ageSummary: string;
  /** Present age bands for coverage targeting (FAM-7). */
  bands: LandmarkAgeTag[];
};

/** Prefer same-day picks within this radius of earlier stops (km). */
export const SAME_DAY_CLUSTER_KM = 5;
/** Tighter cluster when walking / low walking limit. */
export const TIGHT_CLUSTER_KM = 2.5;
/** Wider same-day radius when driving a rental car. */
export const CAR_CLUSTER_KM = 12;
/** Moderate expansion for taxis. */
export const TAXI_CLUSTER_KM = 7;

/**
 * Age bands match the product spec:
 * - toddler: 0–3
 * - young child: 4–7
 * - tween: 8–12
 * - teen: 13+
 */
export function getFamilyAgeProfile(plan: TripPlan): FamilyAgeProfile {
  const ages = plan.children;
  if (ages.length === 0) {
    return {
      youngest: null,
      oldest: null,
      hasToddler: false,
      hasYoungChild: false,
      hasTween: false,
      hasTeen: false,
      isMixedAges: false,
      ageSummary: `${plan.adults} adult${plan.adults !== 1 ? "s" : ""}`,
      bands: [],
    };
  }

  const youngest = Math.min(...ages);
  const oldest = Math.max(...ages);
  const bands: LandmarkAgeTag[] = [];
  const hasToddler = ages.some((a) => a <= 3);
  const hasYoungChild = ages.some((a) => a >= 4 && a <= 7);
  const hasTween = ages.some((a) => a >= 8 && a <= 12);
  const hasTeen = ages.some((a) => a >= 13);
  if (hasToddler) bands.push("toddler");
  if (hasYoungChild) bands.push("child");
  if (hasTween) bands.push("tween");
  if (hasTeen) bands.push("teen");

  return {
    youngest,
    oldest,
    hasToddler,
    hasYoungChild,
    hasTween,
    hasTeen,
    isMixedAges: bands.length > 1,
    ageSummary: youngest === oldest ? `age ${youngest}` : `ages ${youngest}–${oldest}`,
    bands,
  };
}

const TITLE_EXPLORE =
  /\b(museum|zoo|aquarium|park|garden|cove|midway|tower|beach|historic|natural|science|interactive)\b/i;
const TITLE_TEEN = /\b(museum|midway|uss|adventure|sports|tower|historic|science)\b/i;

function hasTag(landmark: Landmark, tag: LandmarkAgeTag): boolean {
  return landmark.ageTags.includes(tag);
}

/** Score a landmark for the family's age bands — missing bands are penalized hard (FAM-7). */
export function landmarkAgeScore(landmark: Landmark, profile: FamilyAgeProfile): number {
  if (profile.bands.length === 0) {
    return 10 + landmark.ageTags.length;
  }

  let score = 10;

  if (profile.hasToddler) {
    if (hasTag(landmark, "toddler")) score += 28;
    else if (hasTag(landmark, "child")) score += 4;
    else score -= 24;
  }

  if (profile.hasYoungChild) {
    if (hasTag(landmark, "child")) score += 22;
    else if (hasTag(landmark, "toddler") || hasTag(landmark, "tween")) score += 8;
    else score -= 14;
  }

  if (profile.hasTween) {
    if (hasTag(landmark, "tween")) score += 18;
    else if (hasTag(landmark, "child") || hasTag(landmark, "teen")) score += 8;
    else score -= 10;
  }

  if (profile.hasTeen) {
    if (hasTag(landmark, "teen")) score += 22;
    else if (hasTag(landmark, "tween")) score += 6;
    else score -= 12;
  }

  if (profile.isMixedAges) {
    const overlap = profile.bands.filter((t) => hasTag(landmark, t)).length;
    score += overlap * 8;
    // Reward multi-band stops that work for everyone on the trip.
    if (overlap === profile.bands.length) score += 16;
  }

  return score;
}

/** Bonus when a pick is meant to cover a specific under-represented age band. */
export function landmarkBandTargetScore(
  landmark: Landmark,
  preferBand: LandmarkAgeTag | null,
): number {
  if (!preferBand) return 0;
  return hasTag(landmark, preferBand) ? 40 : -20;
}

export function landmarkInterestScore(landmark: Landmark, plan: TripPlan): number {
  const wanted = interestTagsFromPlan(plan.interests);
  if (wanted.length === 0) return 4;
  const hits = wanted.filter((tag) => landmark.interestTags.includes(tag)).length;
  if (hits === 0) return -18;
  return hits * 22;
}

export function stayProximityScore(landmark: Landmark, plan: TripPlan): number {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return 0;
  const km = haversineKm(landmark.lat, landmark.lng, plan.stayLat, plan.stayLng);
  // Driving: farther stays are fine — only soft-penalize very long hops.
  if (plan.transportationType === "car-rental") {
    if (km <= 3) return 12;
    if (km <= 8) return 8;
    if (km <= 15) return 2;
    return -(km - 15) * 1.5;
  }
  if (km <= 1.5) return 24;
  if (km <= 3) return 14;
  if (km <= 6) return 4;
  return -(km - 6) * 3;
}

export function walkingFitScore(landmark: Landmark, plan: TripPlan): number {
  const lowWalking =
    plan.walkingLimit === "low" || plan.transportationType === "walking";
  if (!lowWalking) {
    if (plan.walkingLimit === "high" && landmark.intensity === "high") return 6;
    return 0;
  }
  switch (landmark.intensity as LandmarkIntensity) {
    case "low":
      return 18;
    case "medium":
      return 2;
    case "high":
      return -16;
    default:
      return 0;
  }
}

export function clusterRadiusKm(plan: TripPlan): number {
  if (plan.walkingLimit === "low" || plan.transportationType === "walking") {
    return TIGHT_CLUSTER_KM;
  }
  if (plan.transportationType === "car-rental") {
    return CAR_CLUSTER_KM;
  }
  if (plan.transportationType === "taxis") {
    return TAXI_CLUSTER_KM;
  }
  return SAME_DAY_CLUSTER_KM;
}

/** Minimum km from a candidate to any already-picked same-day landmark. */
export function minDistanceKmToPicked(candidate: Landmark, alreadyPicked: Landmark[]): number {
  if (alreadyPicked.length === 0) return 0;
  return Math.min(
    ...alreadyPicked.map((p) => haversineKm(candidate.lat, candidate.lng, p.lat, p.lng)),
  );
}

/** Max pairwise distance among a set of landmarks (km). */
export function maxPairwiseDistanceKm(landmarks: Landmark[]): number {
  if (landmarks.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < landmarks.length; i++) {
    for (let j = i + 1; j < landmarks.length; j++) {
      max = Math.max(
        max,
        haversineKm(landmarks[i].lat, landmarks[i].lng, landmarks[j].lat, landmarks[j].lng),
      );
    }
  }
  return max;
}

function proximityBonus(candidate: Landmark, alreadyPicked: Landmark[], radiusKm: number): number {
  if (alreadyPicked.length === 0) return 0;
  const dist = minDistanceKmToPicked(candidate, alreadyPicked);
  if (dist <= radiusKm) {
    return (radiusKm - dist) * 8;
  }
  return -(dist - radiusKm) * 12;
}

/**
 * Prefer landmarks open for the planned visit window when alternatives exist.
 * Widens beyond the budget/cluster pool before accepting a closed fallback.
 */
function preferOpenPool(
  pool: Landmark[],
  cityLandmarks: Landmark[],
  pickedNames: Set<string>,
  alreadyPicked: Landmark[],
  radiusKm: number,
  visitWindow?: VisitWindow,
): Landmark[] {
  if (!visitWindow) return pool;

  const openIn = (list: Landmark[]) =>
    list.filter((l) => isLandmarkOpenForVisit(l, visitWindow));

  const openPool = openIn(pool);
  if (openPool.length > 0) return openPool;

  let wider = cityLandmarks.filter((l) => !pickedNames.has(l.name));
  if (alreadyPicked.length > 0) {
    const nearby = wider.filter(
      (l) => minDistanceKmToPicked(l, alreadyPicked) <= radiusKm,
    );
    if (nearby.length > 0) wider = nearby;
  }
  const openWider = openIn(wider);
  return openWider.length > 0 ? openWider : pool;
}

export type PickLandmarkOptions = {
  visitWindow?: VisitWindow;
  /** Prefer a landmark that covers this age band (mixed-age day diversification). */
  preferBand?: LandmarkAgeTag | null;
  /** When true and stay coords exist, heavily prefer near-stay for the first pick. */
  anchorToStay?: boolean;
  /** Trip-level names already used on prior days — avoid repeating until the pool is exhausted. */
  excludeNames?: Set<string> | string[];
};

/** Score margin for rotating among near-tied top candidates across days. */
const TOP_SCORE_ROTATION_MARGIN = 18;

export function pickLandmarkForFamily(
  city: CityConfig,
  plan: TripPlan,
  dayNumber: number,
  slotIndex: number,
  alreadyPicked: Landmark[] = [],
  visitWindowOrOpts?: VisitWindow | PickLandmarkOptions,
): Landmark {
  const opts: PickLandmarkOptions =
    visitWindowOrOpts && "startMin" in visitWindowOrOpts
      ? { visitWindow: visitWindowOrOpts }
      : ((visitWindowOrOpts as PickLandmarkOptions | undefined) ?? {});

  const profile = getFamilyAgeProfile(plan);
  const rotation = (dayNumber - 1) * 3 + slotIndex;
  const pickedNames = new Set(alreadyPicked.map((l) => l.name));
  const tripExcluded = new Set(
    opts.excludeNames instanceof Set ? opts.excludeNames : (opts.excludeNames ?? []),
  );
  const radiusKm = clusterRadiusKm(plan);

  const stylePool = landmarksForStyle(city.landmarks, (l) => l.adultPrice, plan.budgetStyle, {
    allowPremiumPick: slotIndex === 0,
  });

  const withoutTripUsed = (list: Landmark[]) =>
    list.filter((l) => !pickedNames.has(l.name) && !tripExcluded.has(l.name));

  let pool = withoutTripUsed(stylePool);
  if (pool.length === 0) {
    pool = withoutTripUsed(city.landmarks);
  }
  // Exhausted unused landmarks — allow reuse rather than failing.
  if (pool.length === 0) {
    pool = stylePool.filter((l) => !pickedNames.has(l.name));
  }
  if (pool.length === 0) {
    pool = city.landmarks.filter((l) => !pickedNames.has(l.name));
  }
  if (pool.length === 0) {
    pool = stylePool.length > 0 ? stylePool : city.landmarks;
  }

  if (alreadyPicked.length > 0) {
    const inCluster = pool.filter((l) => minDistanceKmToPicked(l, alreadyPicked) <= radiusKm);
    if (inCluster.length === 0) {
      const nearby = city.landmarks.filter(
        (l) =>
          !pickedNames.has(l.name) &&
          !tripExcluded.has(l.name) &&
          minDistanceKmToPicked(l, alreadyPicked) <= radiusKm,
      );
      if (nearby.length > 0) {
        pool = nearby;
      }
    } else {
      pool = inCluster;
    }
  }

  pool = preferOpenPool(
    pool,
    city.landmarks,
    pickedNames,
    alreadyPicked,
    radiusKm,
    opts.visitWindow,
  );

  const ranked = [...pool]
    .map((lm) => {
      let score =
        landmarkAgeScore(lm, profile) +
        landmarkInterestScore(lm, plan) +
        stayProximityScore(lm, plan) +
        walkingFitScore(lm, plan) +
        proximityBonus(lm, alreadyPicked, radiusKm) +
        landmarkBandTargetScore(lm, opts.preferBand ?? null);

      // First morning stop: lean harder toward the stay when we have coordinates.
      if (opts.anchorToStay && alreadyPicked.length === 0) {
        score += stayProximityScore(lm, plan);
      }

      return {
        landmark: lm,
        score,
        dist: minDistanceKmToPicked(lm, alreadyPicked),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.dist - b.dist || b.landmark.adultPrice - a.landmark.adultPrice,
    );

  const pickFromRanked = (list: typeof ranked): Landmark => {
    if (list.length === 0) return city.landmarks[0]!;
    const top = list[0]!.score;
    const contenders = list.filter((r) => r.score >= top - TOP_SCORE_ROTATION_MARGIN);
    return contenders[rotation % contenders.length]!.landmark;
  };

  if (alreadyPicked.length > 0) {
    const clustered = ranked.filter((r) => r.dist <= radiusKm);
    if (clustered.length > 0) {
      return pickFromRanked(clustered);
    }
    return pickFromRanked(ranked);
  }

  // First pick: score-first, but rotate among near-tied winners across days.
  return pickFromRanked(ranked);
}

/** Which family age bands are still missing from already-picked landmarks. */
export function uncoveredAgeBands(
  profile: FamilyAgeProfile,
  alreadyPicked: Landmark[],
): LandmarkAgeTag[] {
  if (profile.bands.length === 0) return [];
  const covered = new Set(alreadyPicked.flatMap((l) => l.ageTags));
  return profile.bands.filter((b) => !covered.has(b));
}

export function activityNoteForFamily(plan: TripPlan, day: number): string {
  const profile = getFamilyAgeProfile(plan);
  const travelers = `${plan.adults} adult${plan.adults > 1 ? "s" : ""}${
    plan.children.length
      ? ` and ${plan.children.length} kid${plan.children.length > 1 ? "s" : ""} (${profile.ageSummary})`
      : ""
  }`;

  if (!plan.children.length) {
    return `Day ${day} — planned for ${travelers}.`;
  }
  if (profile.isMixedAges) {
    return `Day ${day} — mixed-age family (${profile.ageSummary}): picks with something for everyone.`;
  }
  if (profile.hasTeen && !profile.hasToddler) {
    return `Day ${day} — great for older kids and teens, plus ${plan.adults} adult${plan.adults > 1 ? "s" : ""}.`;
  }
  if (profile.hasToddler) {
    return `Day ${day} — toddler-friendly pacing with hands-on stops for ${travelers}.`;
  }
  return `Day ${day} highlight — tailored for ${travelers}.`;
}

export function suggestActivityTitle(
  landmarkName: string,
  plan: TripPlan,
  _slot: "morning" | "afternoon",
): string {
  const profile = getFamilyAgeProfile(plan);

  if (TITLE_EXPLORE.test(landmarkName)) {
    return `Explore ${landmarkName}`;
  }
  if (profile.hasTeen && TITLE_TEEN.test(landmarkName)) {
    return `Visit ${landmarkName}`;
  }
  return `Family time at ${landmarkName}`;
}

export function ageAwareTravelerHints(children: number[]): string[] {
  if (children.length === 0) return [];

  const profile = getFamilyAgeProfile({ children, adults: 2 } as TripPlan);
  const hints: string[] = [];

  if (profile.isMixedAges) {
    hints.push("Mixed ages — we'll balance interactive museums, scenic spots, and flexible pacing.");
  } else if (profile.hasTeen) {
    hints.push("We'll include engaging stops your teens won't find boring.");
  } else if (profile.hasTween) {
    hints.push("Hands-on museums and active outings work well for this age group.");
  } else if (profile.hasToddler) {
    hints.push("We'll keep toddler-friendly pacing with room to explore.");
  }

  if (children.length >= 3) {
    hints.push("Big crew — we'll keep logistics simple and group-friendly.");
  }

  return hints;
}
