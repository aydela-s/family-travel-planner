import { CityConfig } from "@/config/city-pricing";
import { landmarksForStyle } from "@/lib/pricing/budget-style";
import { TripPlan } from "@/types/trip-plan";

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
      if (age <= 8) return "young";
      if (age <= 12) return "tween";
      return "teen";
    }),
  );

  return {
    youngest,
    oldest,
    hasToddler: ages.some((a) => a <= 3),
    hasYoungChild: ages.some((a) => a >= 4 && a <= 8),
    hasTween: ages.some((a) => a >= 9 && a <= 12),
    hasTeen: ages.some((a) => a >= 13),
    isMixedAges: bands.size > 1,
    ageSummary: youngest === oldest ? `age ${youngest}` : `ages ${youngest}–${oldest}`,
  };
}

const TODDLER_FOCUS = /\b(playground|toddler|baby|stroller|nursery)\b/i;
const MIXED_APPEAL = /\b(museum|zoo|aquarium|park|garden|cove|midway|tower|beach|historic|natural|science|interactive)\b/i;
const TEEN_APPEAL = /\b(museum|midway|uss|adventure|sports|tower|historic|science)\b/i;

function landmarkAgeScore(name: string, profile: FamilyAgeProfile): number {
  let score = 10;
  if (TODDLER_FOCUS.test(name)) {
    score = profile.hasToddler && !profile.isMixedAges ? 20 : profile.hasToddler ? 8 : 2;
  }
  if (MIXED_APPEAL.test(name)) score += 15;
  if (profile.hasTeen && TEEN_APPEAL.test(name)) score += 12;
  if (profile.hasTween && MIXED_APPEAL.test(name)) score += 8;
  if (profile.isMixedAges && MIXED_APPEAL.test(name)) score += 10;
  if (profile.hasToddler && !profile.isMixedAges && TODDLER_FOCUS.test(name)) score += 5;
  return score;
}

export function pickLandmarkForFamily(
  city: CityConfig,
  plan: TripPlan,
  dayNumber: number,
  slotIndex: number,
): CityConfig["landmarks"][0] {
  const profile = getFamilyAgeProfile(plan);
  const rotation = (dayNumber - 1) * 3 + slotIndex;

  // Slot 0 is each day's main activity — under "balanced," this is the one
  // slot allowed to reach into the paid/premium tier ("one major paid
  // attraction per day"). Other slots stay in the cheap/free tier.
  const stylePool = landmarksForStyle(city.landmarks, (l) => l.adultPrice, plan.budgetStyle, {
    allowPremiumPick: slotIndex === 0,
  });

  const ranked = [...stylePool]
    .map((landmark) => ({ landmark, score: landmarkAgeScore(landmark.name, profile) }))
    .sort((a, b) => b.score - a.score || b.landmark.adultPrice - a.landmark.adultPrice);

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
  slot: "morning" | "afternoon",
): string {
  const profile = getFamilyAgeProfile(plan);
  const prefix = slot === "morning" ? "Morning:" : "Afternoon:";

  if (MIXED_APPEAL.test(landmarkName)) {
    return `${prefix} Explore ${landmarkName}`;
  }
  if (profile.hasTeen && TEEN_APPEAL.test(landmarkName)) {
    return `${prefix} Visit ${landmarkName}`;
  }
  return `${prefix} Family time at ${landmarkName}`;
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
