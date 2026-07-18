import { CityConfig, Landmark, LandmarkAgeTag } from "@/config/city-pricing";
import { haversineKm } from "@/lib/maps/directions";
import { landmarksForStyle } from "@/lib/pricing/budget-style";
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
};

/** Prefer same-day picks within this radius of earlier stops (km). */
export const SAME_DAY_CLUSTER_KM = 5;

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
    };
  }

  const youngest = Math.min(...ages);
  const oldest = Math.max(...ages);
  const bands = new Set(
    ages.map((age) => {
      if (age <= 3) return "toddler";
      if (age <= 7) return "young";
      if (age <= 12) return "tween";
      return "teen";
    }),
  );

  return {
    youngest,
    oldest,
    hasToddler: ages.some((a) => a <= 3),
    hasYoungChild: ages.some((a) => a >= 4 && a <= 7),
    hasTween: ages.some((a) => a >= 8 && a <= 12),
    hasTeen: ages.some((a) => a >= 13),
    isMixedAges: bands.size > 1,
    ageSummary: youngest === oldest ? `age ${youngest}` : `ages ${youngest}–${oldest}`,
  };
}

const TITLE_EXPLORE = /\b(museum|zoo|aquarium|park|garden|cove|midway|tower|beach|historic|natural|science|interactive)\b/i;
const TITLE_TEEN = /\b(museum|midway|uss|adventure|sports|tower|historic|science)\b/i;

function hasTag(landmark: Landmark, tag: LandmarkAgeTag): boolean {
  return landmark.ageTags.includes(tag);
}

/** Score a landmark for the family's age bands using catalog ageTags. */
export function landmarkAgeScore(landmark: Landmark, profile: FamilyAgeProfile): number {
  if (!profile.hasToddler && !profile.hasYoungChild && !profile.hasTween && !profile.hasTeen) {
    return 10 + landmark.ageTags.length;
  }

  let score = 10;

  if (profile.hasToddler) {
    if (hasTag(landmark, "toddler")) score += 22;
    else if (hasTag(landmark, "child")) score += 6;
    else score -= 8;
  }

  if (profile.hasYoungChild) {
    if (hasTag(landmark, "child")) score += 18;
    else if (hasTag(landmark, "toddler") || hasTag(landmark, "tween")) score += 8;
  }

  if (profile.hasTween) {
    // Spec: mix of child + teen activities for 8–12.
    if (hasTag(landmark, "tween")) score += 14;
    if (hasTag(landmark, "child")) score += 8;
    if (hasTag(landmark, "teen")) score += 8;
  }

  if (profile.hasTeen) {
    if (hasTag(landmark, "teen")) score += 18;
    else if (hasTag(landmark, "tween")) score += 6;
    else if (!hasTag(landmark, "toddler")) score += 2;
  }

  if (profile.isMixedAges) {
    const relevant: LandmarkAgeTag[] = [];
    if (profile.hasToddler) relevant.push("toddler");
    if (profile.hasYoungChild) relevant.push("child");
    if (profile.hasTween) relevant.push("tween");
    if (profile.hasTeen) relevant.push("teen");
    const overlap = relevant.filter((t) => hasTag(landmark, t)).length;
    score += overlap * 6;
  }

  return score;
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

function proximityBonus(candidate: Landmark, alreadyPicked: Landmark[]): number {
  if (alreadyPicked.length === 0) return 0;
  const dist = minDistanceKmToPicked(candidate, alreadyPicked);
  if (dist <= SAME_DAY_CLUSTER_KM) {
    return (SAME_DAY_CLUSTER_KM - dist) * 8;
  }
  return -(dist - SAME_DAY_CLUSTER_KM) * 12;
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
      (l) => minDistanceKmToPicked(l, alreadyPicked) <= SAME_DAY_CLUSTER_KM,
    );
    if (nearby.length > 0) wider = nearby;
  }
  const openWider = openIn(wider);
  return openWider.length > 0 ? openWider : pool;
}

export function pickLandmarkForFamily(
  city: CityConfig,
  plan: TripPlan,
  dayNumber: number,
  slotIndex: number,
  alreadyPicked: Landmark[] = [],
  visitWindow?: VisitWindow,
): Landmark {
  const profile = getFamilyAgeProfile(plan);
  const rotation = (dayNumber - 1) * 3 + slotIndex;
  const pickedNames = new Set(alreadyPicked.map((l) => l.name));

  const stylePool = landmarksForStyle(city.landmarks, (l) => l.adultPrice, plan.budgetStyle, {
    allowPremiumPick: slotIndex === 0,
  });

  let pool = stylePool.filter((l) => !pickedNames.has(l.name));
  if (pool.length === 0) {
    pool = city.landmarks.filter((l) => !pickedNames.has(l.name));
  }
  if (pool.length === 0) {
    pool = stylePool.length > 0 ? stylePool : city.landmarks;
  }

  if (alreadyPicked.length > 0) {
    const inCluster = pool.filter((l) => minDistanceKmToPicked(l, alreadyPicked) <= SAME_DAY_CLUSTER_KM);
    if (inCluster.length === 0) {
      const nearby = city.landmarks.filter(
        (l) =>
          !pickedNames.has(l.name) &&
          minDistanceKmToPicked(l, alreadyPicked) <= SAME_DAY_CLUSTER_KM,
      );
      if (nearby.length > 0) {
        pool = nearby;
      }
    } else {
      pool = inCluster;
    }
  }

  pool = preferOpenPool(pool, city.landmarks, pickedNames, alreadyPicked, visitWindow);

  const ranked = [...pool]
    .map((lm) => ({
      landmark: lm,
      score: landmarkAgeScore(lm, profile) + proximityBonus(lm, alreadyPicked),
      dist: minDistanceKmToPicked(lm, alreadyPicked),
    }))
    .sort((a, b) => b.score - a.score || a.dist - b.dist || b.landmark.adultPrice - a.landmark.adultPrice);

  if (alreadyPicked.length > 0) {
    const clustered = ranked.filter((r) => r.dist <= SAME_DAY_CLUSTER_KM);
    if (clustered.length > 0) {
      return clustered[rotation % clustered.length].landmark;
    }
    return ranked[0].landmark;
  }

  return ranked[rotation % ranked.length].landmark;
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
