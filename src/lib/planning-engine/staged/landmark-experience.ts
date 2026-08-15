import type { Landmark } from "@/config/city-pricing";
import type { BudgetStyle } from "@/types/trip-plan";

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

const INDOOR_PLAY_NAME =
  /\b(kids\s*empire|soft\s*play|dino\s*kidz|fritz'?s?\s*adventure|adventure\s*park|urban\s*air|sky\s*zone|bounce\s*house|trampolin|indoor\s*play|play\s*cafe)\b/i;

/** Indoor play / trampoline / bounce / soft-play / indoor adventure centers. */
export function isIndoorPlayExperience(landmark: Landmark): boolean {
  if (landmark.interestTags.includes("indoor-play")) return true;
  if (INDOOR_PLAY_NAME.test(landmark.name)) return true;
  return Boolean(landmark.indoor && landmark.interestTags.includes("playgrounds"));
}

/** Outdoor playground (not indoor soft play). */
export function isOutdoorPlayground(landmark: Landmark): boolean {
  if (isIndoorPlayExperience(landmark)) return false;
  if (!landmark.interestTags.includes("playgrounds")) return false;
  if (landmark.indoor) return false;
  return true;
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
  // Derive exclusivity from experience helpers so name-based venues (Fritz's, DINO KIDZ)
  // still conflict even when Places tags are messy.
  if (isIndoorPlayExperience(landmark)) {
    cats.add("indoor-play");
    cats.delete("playgrounds");
  }
  if (isOutdoorPlayground(landmark)) cats.add("playgrounds");
  if (isThemeParkExperience(landmark)) cats.add("theme-parks");
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

/** Adult ticket above this is premium for balanced family trips (Zoo ~$72 is out). */
export const BALANCED_MAX_ADULT_TICKET = 45;
/** Save style keeps to lower-cost paid stops (e.g. science centers). */
export const SAVE_MAX_ADULT_TICKET = 28;

/** Full-day hero or support that should not be doubled on one day (zoo + boardwalk, etc.). */
export function isHeavyDayLandmark(landmark: Landmark): boolean {
  if (landmark.intensity === "high") return true;
  return landmark.interestTags.some((t) => t === "theme-parks" || t === "zoos");
}

export function sharesHeavyDayLoad(a: Landmark, b: Landmark): boolean {
  return isHeavyDayLandmark(a) && isHeavyDayLandmark(b);
}

export function dayAlreadyHasHeavyLandmark(others: Landmark[]): boolean {
  return others.some(isHeavyDayLandmark);
}

export function exceedsBudgetStyleTicket(
  landmark: Landmark,
  budgetStyle: BudgetStyle | "" | undefined,
): boolean {
  if (landmark.adultPrice <= 0) return false;
  const style = budgetStyle || "balanced";
  if (style === "splurge") return false;
  const max = style === "save" ? SAVE_MAX_ADULT_TICKET : BALANCED_MAX_ADULT_TICKET;
  return landmark.adultPrice > max;
}

export function fitsBudgetStyle(
  landmark: Landmark,
  budgetStyle: BudgetStyle | "" | undefined,
): boolean {
  return !exceedsBudgetStyleTicket(landmark, budgetStyle);
}

/** Boardwalk / amusement-park style stops (Belmont Park, etc.). */
export function isThemeParkExperience(landmark: Landmark): boolean {
  return landmark.interestTags.includes("theme-parks");
}

/**
 * Low-key complement for a theme-park or heavy day — outdoor, flexible, not another ticketed venue.
 */
export function isChillDayCompanion(landmark: Landmark): boolean {
  if (isThemeParkExperience(landmark) || isHeavyDayLandmark(landmark)) return false;
  if (landmark.intensity === "high") return false;
  if (
    landmark.interestTags.some((t) =>
      ["museums", "interactive", "indoor-play", "zoos"].includes(t),
    )
  ) {
    return false;
  }
  if (landmark.indoor && landmark.adultPrice > 0) return false;
  if (landmark.intensity === "low") return true;
  return (
    landmark.adultPrice <= 0 &&
    !landmark.indoor &&
    landmark.interestTags.some((t) =>
      ["parks", "beaches", "nature", "playgrounds", "history"].includes(t),
    )
  );
}

/**
 * Whether two stops belong on the same day.
 * Theme parks are exclusive (exhausting with little kids) — no second activity.
 */
export function pairingAllowedForDay(a: Landmark, b: Landmark): boolean {
  if (sharesHeavyDayLoad(a, b)) return false;
  if (isThemeParkExperience(a) || isThemeParkExperience(b)) return false;
  // Two soft-play / indoor adventure centers is too much for one day.
  if (isIndoorPlayExperience(a) && isIndoorPlayExperience(b)) return false;
  if (sharesDayActivityCategory(a, b)) return false;
  return true;
}
