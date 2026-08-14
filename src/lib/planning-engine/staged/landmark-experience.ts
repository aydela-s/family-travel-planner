import type { Landmark } from "@/config/city-pricing";

/** ~20–30 min urban drive — prefer stays inside this for arrival/departure. */
export const LOW_FRICTION_STAY_KM = 12;
/** Soft sweet spot (~15–20 min). */
export const LOW_FRICTION_PREFERRED_KM = 8;

/**
 * True shoreline / ocean experience suitable as a beach-day anchor.
 * Parks that merely sit near water (e.g. Mission Bay Park) are support, not anchors.
 */
export function isShorelineBeachExperience(landmark: Landmark): boolean {
  if (!landmark.interestTags.includes("beaches")) return false;
  // Theme parks / paid boardwalk attractions are entertainment anchors, not beach-day heroes.
  if (landmark.interestTags.includes("theme-parks")) return false;
  const n = landmark.name.toLowerCase();
  if (/\b(cove|beach|boardwalk|shore|ocean|pier|seawall)\b/.test(n)) return true;
  // Bay parks / reserves tagged beaches but not the shoreline experience
  if (/\b(park|reserve|preserve|aquarium)\b/.test(n)) return false;
  return false;
}

/** Outdoor playground (not indoor soft play). */
export function isOutdoorPlayground(landmark: Landmark): boolean {
  if (!landmark.interestTags.includes("playgrounds")) return false;
  if (landmark.interestTags.includes("indoor-play")) return false;
  if (landmark.indoor) return false;
  return true;
}

/** Indoor play / trampoline / bounce / soft-play. */
export function isIndoorPlayExperience(landmark: Landmark): boolean {
  if (landmark.interestTags.includes("indoor-play")) return true;
  return Boolean(landmark.indoor && landmark.interestTags.includes("playgrounds"));
}

/** Waterfront / shoreline experiences — at most one per day alongside other water tags. */
export function isWaterfrontExperience(landmark: Landmark): boolean {
  if (landmark.interestTags.includes("beaches")) return true;
  return /\b(waterfront|beach|cove|boardwalk|bay|harbor|pier|shore|seawall)\b/i.test(
    landmark.name,
  );
}

/** Interest tags that should not repeat across anchor + support on the same day. */
export const DAY_EXCLUSIVE_ACTIVITY_TAGS = [
  "beaches",
  "zoos",
  "theme-parks",
  "interactive",
  "indoor-play",
  "playgrounds",
] as const;

export function dayActivityCategories(landmark: Landmark): Set<string> {
  const cats = new Set<string>();
  for (const tag of DAY_EXCLUSIVE_ACTIVITY_TAGS) {
    if (landmark.interestTags.includes(tag)) cats.add(tag);
  }
  if (isWaterfrontExperience(landmark)) cats.add("waterfront");
  return cats;
}

export function sharesDayActivityCategory(a: Landmark, b: Landmark): boolean {
  const left = dayActivityCategories(a);
  for (const cat of dayActivityCategories(b)) {
    if (left.has(cat)) return true;
  }
  return false;
}

export function sharesAnyDayActivityCategory(landmark: Landmark, others: Landmark[]): boolean {
  return others.some((other) => sharesDayActivityCategory(landmark, other));
}

/** Toddler/young-child only — weak for mixed families with tweens/teens. */
export function isYoungChildOnlyLandmark(landmark: Landmark): boolean {
  const hasOlder = landmark.ageTags.some((t) => t === "tween" || t === "teen");
  if (hasOlder) return false;
  return landmark.ageTags.every((t) => t === "toddler" || t === "child");
}

export function hasTicketRequirement(landmark: Landmark): boolean {
  return landmark.adultPrice > 0 || Boolean(landmark.ticketTiers?.length);
}

export function hasFixedOpeningHours(landmark: Landmark): boolean {
  return Boolean(landmark.openingHours || landmark.hoursByWeekday);
}
