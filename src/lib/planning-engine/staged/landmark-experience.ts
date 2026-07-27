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

/** Toddler/young-child only — weak for mixed families with tweens/teens. */
export function isYoungChildOnlyLandmark(landmark: Landmark): boolean {
  if (landmark.ageTags.length === 0) return false;
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
