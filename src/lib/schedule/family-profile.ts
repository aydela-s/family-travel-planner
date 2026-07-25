import { CityConfig, Landmark, LandmarkAgeTag, LandmarkIntensity } from "@/config/city-pricing";
import { CLUSTER_PREFER_SCORE_MARGIN, clusterRadiusKm } from "@/config/cluster-distances";
import { haversineKm } from "@/lib/maps/directions";
import { landmarksForStyle } from "@/lib/pricing/budget-style";
import {
  interestTagsFromPlan,
  primaryInterestTagsFromPlan,
} from "@/lib/schedule/interest-map";
import { isLandmarkOpenForVisit, VisitWindow } from "@/lib/schedule/landmark-hours";
import { TripPlan } from "@/types/trip-plan";

export type { VisitWindow };

/** Re-export cluster distances from the shared config (adjust values there only). */
export {
  CAR_CLUSTER_KM,
  CLUSTER_PREFER_SCORE_MARGIN,
  clusterRadiusKm,
  PUBLIC_TRANSIT_CLUSTER_KM,
  TAXI_CLUSTER_KM,
  WALKING_CLUSTER_KM,
} from "@/config/cluster-distances";

/** @deprecated Use PUBLIC_TRANSIT_CLUSTER_KM. */
export const SAME_DAY_CLUSTER_KM = 5;
/** @deprecated Use WALKING_CLUSTER_KM. */
export const TIGHT_CLUSTER_KM = 3;

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
  const primary = primaryInterestTagsFromPlan(plan.interests);
  let score = 0;
  let hits = 0;
  for (const tag of wanted) {
    if (!landmark.interestTags.includes(tag)) continue;
    hits += 1;
    // Primary wizard tags (e.g. playgrounds) outrank secondary aliases (e.g. museums from Interactive).
    score += primary.has(tag) ? 36 : 14;
  }
  if (hits === 0) return -18;
  // Specialized kid interests should beat scenic park aliases when both are selected.
  const wantsKidPlay =
    primary.has("playgrounds") ||
    wanted.includes("playgrounds") ||
    wanted.includes("indoor-play");
  const isKidPlay =
    landmark.interestTags.includes("playgrounds") ||
    landmark.interestTags.includes("indoor-play");
  if (wantsKidPlay && isKidPlay) {
    score += 28;
  }
  if (primary.has("interactive") && landmark.interestTags.includes("interactive")) {
    score += 20;
  }
  return score;
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
    // Prefer closer stops inside the preferred cluster.
    return (radiusKm - dist) * 8 + 16;
  }
  // Soft penalty beyond the radius — slight overshoot is allowed when needed.
  return -(dist - radiusKm) * 5;
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

const STROLLER_QUIET_TAGS = new Set([
  "parks",
  "beaches",
  "nature",
  "shopping",
  "food-markets",
  "playgrounds",
]);
const STROLLER_LOUD_TAGS = new Set(["theme-parks", "entertainment", "zoos", "interactive"]);

/** Soft bias toward quiet / low-stimulation stops during a stroller nap (FAM-52). */
export function strollerQuietScore(landmark: Landmark): number {
  let score = 0;
  switch (landmark.intensity as LandmarkIntensity) {
    case "low":
      score += 26;
      break;
    case "medium":
      score += 2;
      break;
    case "high":
      score -= 32;
      break;
    default:
      break;
  }
  const quietHits = landmark.interestTags.filter((t) => STROLLER_QUIET_TAGS.has(t)).length;
  const loudHits = landmark.interestTags.filter((t) => STROLLER_LOUD_TAGS.has(t)).length;
  score += quietHits * 14;
  score -= loudHits * 18;
  if (/\b(park|garden|waterfront|promenade|harbor|beach|walk|shopping)\b/i.test(landmark.name)) {
    score += 10;
  }
  return score;
}

export type PickLandmarkOptions = {
  visitWindow?: VisitWindow;
  /** Prefer a landmark that covers this age band (mixed-age day diversification). */
  preferBand?: LandmarkAgeTag | null;
  /** When true and stay coords exist, heavily prefer near-stay for the first pick. */
  anchorToStay?: boolean;
  /** Trip-level names already used on prior days — avoid repeating until the pool is exhausted. */
  excludeNames?: Set<string> | string[];
  /** Prefer quiet low-intensity landmarks (stroller nap window). */
  strollerQuiet?: boolean;
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
  const wantedTags = interestTagsFromPlan(plan.interests);
  // Afternoon/extra slots normally stay in the cheap tier; expand when the family
  // asked for playgrounds / interactive stops that often sit in mid-tier pricing.
  const expandActivityTier =
    slotIndex <= 2 &&
    (wantedTags.includes("playgrounds") ||
      wantedTags.includes("indoor-play") ||
      wantedTags.includes("interactive"));

  const stylePool = landmarksForStyle(city.landmarks, (l) => l.adultPrice, plan.budgetStyle, {
    allowPremiumPick:
      slotIndex === 0 ||
      expandActivityTier ||
      // Packed extras need the mid/premium pool or free parks recycle across days.
      (plan.travelStyle === "packed" && slotIndex <= 2),
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

  // Theme parks are half-day commitments — afternoon (not morning-before-lunch, not short extras).
  if (slotIndex === 0 || slotIndex >= 2) {
    const withoutTheme = pool.filter((l) => !l.interestTags.includes("theme-parks"));
    if (withoutTheme.length > 0) pool = withoutTheme;
  }

  if (alreadyPicked.length > 0) {
    // Soft preference: keep the full pool so scoring can slightly exceed the
    // radius when in-cluster options are unsuitable — do not hard-filter.
    const inCluster = pool.filter((l) => minDistanceKmToPicked(l, alreadyPicked) <= radiusKm);
    if (inCluster.length === 0) {
      const nearby = city.landmarks.filter(
        (l) =>
          !pickedNames.has(l.name) &&
          !tripExcluded.has(l.name) &&
          minDistanceKmToPicked(l, alreadyPicked) <= radiusKm,
      );
      // Prefer nearby unused city landmarks when the style pool has none in range.
      if (nearby.length > 0) {
        pool = [...pool, ...nearby.filter((l) => !pool.some((p) => p.name === l.name))];
      }
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

      if (opts.strollerQuiet) {
        score += strollerQuietScore(lm);
      }

      // Strongly prefer unused trip landmarks when the pool had to allow reuse.
      if (tripExcluded.has(lm.name)) {
        score -= 100;
      }

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
    const topScore = ranked[0]?.score ?? 0;
    const inCluster = ranked.filter((r) => r.dist <= radiusKm);
    // Prefer in-cluster picks when they are competitively scored.
    const competitive = inCluster.filter(
      (r) => r.score >= topScore - CLUSTER_PREFER_SCORE_MARGIN,
    );
    if (competitive.length > 0) {
      return pickFromRanked(competitive);
    }
    // Soft fallback: allow slightly exceeding the preferred radius.
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
  if (!plan.children.length) {
    return `Day ${day} — planned for ${plan.adults} adult${plan.adults > 1 ? "s" : ""}.`;
  }
  if (profile.isMixedAges) {
    return `Day ${day} — mixed ages (${profile.ageSummary}).`;
  }
  if (profile.hasTeen && !profile.hasToddler) {
    return `Day ${day} — good for teens and adults.`;
  }
  if (profile.hasToddler) {
    return `Day ${day} — toddler-friendly pacing.`;
  }
  return `Day ${day} — tailored for ${profile.ageSummary}.`;
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
