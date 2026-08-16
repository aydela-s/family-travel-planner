import type { CityConfig, Landmark, LandmarkInterestTag } from "@/config/city-pricing";
import { addDays } from "@/lib/format";
import { morningActivityDefaultTime } from "@/lib/planning-engine/skeleton-builder";
import type { DayLandmarkContext } from "@/lib/planning-engine/types";
import {
  selectAnchorForDay,
  selectSoftFiller,
  toCommittedStop,
} from "@/lib/planning-engine/staged/anchor-selector";
import { selectSupportForDay } from "@/lib/planning-engine/staged/support-selector";
import { markExperienceCompletedByKeys } from "@/lib/planning-engine/staged/experience-coverage";
import {
  isIndoorPlayExperience,
  isOutdoorPlayground,
  isBeachThemeAnchor,
  isThemeParkExperience,
  isYoungChildOnlyLandmark,
} from "@/lib/planning-engine/staged/landmark-experience";
import type {
  DayBlueprint,
  ExperienceCoverage,
  TripBlueprint,
} from "@/lib/planning-engine/staged/types";
import { getFamilyAgeProfile, landmarkAgeScore } from "@/lib/schedule/family-profile";
import { getNapWindow, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import { minutesToTime, parseTimeToMinutes } from "@/lib/schedule/timeline";
import type { VisitWindow } from "@/lib/schedule/landmark-hours";
import type { DayIntent } from "@/lib/planning-engine/types";
import type { TripPlan } from "@/types/trip-plan";

function visitWindowFromTime(
  startTime: string,
  durationMin: number,
  visitDate: string,
): VisitWindow {
  const startMin = parseTimeToMinutes(startTime);
  return { startMin, endMin: startMin + durationMin, visitDate };
}

function findLandmark(city: CityConfig, name: string): Landmark | undefined {
  return city.landmarks.find((l) => l.name === name);
}

function anchorVisitWindow(plan: TripPlan, day: DayBlueprint): VisitWindow {
  const activityMins = Math.max(
    day.capacity.activityDurationMin,
    day.constraints.some((c) => c.type === "require_half_day_window") ? 240 : 0,
  );
  const visitDate = day.date || addDays(plan.startDate, day.dayIndex - 1);
  const nap = shouldIncludeNaps(plan) ? getNapWindow(plan) : null;
  const halfDay = day.constraints.some((c) => c.type === "require_half_day_window");
  if (halfDay) {
    const start = nap
      ? minutesToTime(Math.min(nap.endMin + 15, 16 * 60))
      : "13:15";
    return visitWindowFromTime(start, Math.max(activityMins, 240), visitDate);
  }
  // Default hero window: post-nap afternoon or late morning for short days
  if (day.capacity.maxActivitiesPerDay <= 1 || day.role === "departure") {
    return visitWindowFromTime(morningActivityDefaultTime(plan), activityMins, visitDate);
  }
  const start = nap ? minutesToTime(Math.min(nap.endMin + 15, 16 * 60)) : "13:15";
  return visitWindowFromTime(start, activityMins, visitDate);
}

function supportVisitWindow(plan: TripPlan, day: DayBlueprint): VisitWindow {
  const visitDate = day.date || addDays(plan.startDate, day.dayIndex - 1);
  return visitWindowFromTime(
    morningActivityDefaultTime(plan),
    day.capacity.activityDurationMin,
    visitDate,
  );
}

/**
 * Coverage keys for a stop — keep outdoor playgrounds and indoor play in separate buckets.
 */
export function coverageKeysFromLandmark(landmark: Landmark): string[] {
  const keys: string[] = [];
  if (isIndoorPlayExperience(landmark)) keys.push("indoor-play");
  else if (isOutdoorPlayground(landmark)) keys.push("playgrounds");

  for (const tag of landmark.interestTags) {
    if (tag === "playgrounds" || tag === "indoor-play") continue;
    if (!keys.includes(tag)) keys.push(tag);
  }
  return keys;
}

/**
 * Selected interests the trip has not covered yet. Selection fills these before
 * reaching for anything the family did not ask for.
 */
export function uncoveredSelectedTags(
  coverage: ExperienceCoverage,
): LandmarkInterestTag[] {
  return coverage.items
    .filter((item) => item.source === "interest" && item.completed < item.target)
    .map((item) => item.tag);
}

function anchorMatchesTheme(day: DayBlueprint, anchor: Landmark): boolean {
  if (day.theme.id === "beach") return isBeachThemeAnchor(anchor);
  if (day.theme.id === "play_indoor") return isIndoorPlayExperience(anchor);
  if (day.theme.id === "playgrounds") return isOutdoorPlayground(anchor);
  const primary = day.theme.primaryTags;
  if (primary.length === 0) return true;
  return primary.some((t) => anchor.interestTags.includes(t));
}

function dayHasAgeAppropriateElement(
  plan: TripPlan,
  stops: Landmark[],
): boolean {
  const profile = getFamilyAgeProfile(plan);
  if (stops.length === 0) return false;
  // Mixed families need at least one stop that scores positively for the group
  if (profile.isMixedAges) {
    return stops.some((l) => landmarkAgeScore(l, profile) >= 10);
  }
  return stops.some((l) => landmarkAgeScore(l, profile) > 0);
}

function dayHasOlderAppeal(stops: Landmark[]): boolean {
  return stops.some(
    (l) =>
      l.ageTags.includes("tween") ||
      l.ageTags.includes("teen") ||
      l.interestTags.some((t) =>
        ["history", "interactive", "entertainment", "beaches", "nature", "food-markets"].includes(
          t,
        ),
      ),
  );
}

function isToddlerOnlyDay(stops: Landmark[]): boolean {
  if (stops.length === 0) return false;
  return stops.every(isYoungChildOnlyLandmark);
}

/**
 * Select anchor + support for every day; update ledger + ExperienceCoverage.
 * Hard-excludes used landmarks across the trip while unused options remain.
 * Mixed families: at most one toddler-only full day; each full day needs theme match + age fit.
 */
export function commitStopsToBlueprint(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
): TripBlueprint {
  const ledgerNames = new Set(blueprint.ledger.landmarkNames);
  const priorFullDayAnchors = new Set<string>();
  let coverage = blueprint.experienceCoverage;
  const days: DayBlueprint[] = [];
  const profile = getFamilyAgeProfile(plan);
  let toddlerOnlyFullDays = 0;

  for (const day of blueprint.days) {
    const anchorWindow = anchorVisitWindow(plan, day);
    const softExclude = new Set<string>();

    // Mixed families: block additional toddler-only anchors on full days
    if (
      profile.isMixedAges &&
      day.role === "full" &&
      toddlerOnlyFullDays >= 1
    ) {
      for (const lm of city.landmarks) {
        if (isYoungChildOnlyLandmark(lm)) softExclude.add(lm.name);
      }
    }

    let anchor = selectAnchorForDay(city, plan, day, {
      visitWindow: anchorWindow,
      ledgerNames,
      softExcludeNames: softExclude,
      priorFullDayAnchors,
    });

    // Full-day theme match: re-pick once if the winner misses the theme
    if (day.role === "full" && !anchorMatchesTheme(day, anchor)) {
      const themedExclude = new Set(softExclude);
      themedExclude.add(anchor.name);
      const retry = selectAnchorForDay(city, plan, day, {
        visitWindow: anchorWindow,
        ledgerNames,
        softExcludeNames: themedExclude,
        priorFullDayAnchors,
      });
      if (anchorMatchesTheme(day, retry)) anchor = retry;
    }

    ledgerNames.add(anchor.name);
    if (day.role === "full") priorFullDayAnchors.add(anchor.name);

    const uncovered = uncoveredSelectedTags(coverage);

    let support = selectSupportForDay(city, plan, day, anchor, {
      visitWindow: supportVisitWindow(plan, day),
      ledgerNames,
      alreadyToday: [anchor],
      uncoveredSelectedTags: uncovered,
    });

    // Ensure at least one age-appropriate element on full days (never on theme-park days)
    if (
      day.role === "full" &&
      !isThemeParkExperience(anchor) &&
      day.theme.id !== "theme_park" &&
      !dayHasAgeAppropriateElement(plan, [anchor, ...support])
    ) {
      const filler = selectSoftFiller(
        city,
        plan,
        day,
        anchor,
        ledgerNames,
        supportVisitWindow(plan, day),
        [anchor, ...support],
        { uncoveredSelectedTags: uncovered },
      );
      if (filler && landmarkAgeScore(filler, profile) > 0) {
        support = [filler, ...support].slice(0, Math.max(1, day.capacity.maxSupportStops));
      }
    }

    // Mixed families: full days need older appeal when the anchor is young-only
    if (
      profile.isMixedAges &&
      day.role === "full" &&
      !isThemeParkExperience(anchor) &&
      day.theme.id !== "theme_park" &&
      isYoungChildOnlyLandmark(anchor) &&
      !dayHasOlderAppeal([anchor, ...support])
    ) {
      const filler = selectSoftFiller(
        city,
        plan,
        day,
        anchor,
        ledgerNames,
        supportVisitWindow(plan, day),
        [anchor, ...support],
        { uncoveredSelectedTags: uncovered },
      );
      if (filler && dayHasOlderAppeal([filler])) {
        support = [filler, ...support].slice(0, Math.max(1, day.capacity.maxSupportStops));
      }
    }

    for (const s of support) ledgerNames.add(s.name);

    if (day.role === "full" && isToddlerOnlyDay([anchor, ...support])) {
      toddlerOnlyFullDays += 1;
    }

    // Arrival/departure do not consume interest coverage quotas
    if (day.role === "full" || day.role === "recovery") {
      const coveredKeys = coverageKeysFromLandmark(anchor);
      // Prefer theme primary coverage keys when present on the anchor
      const themeKeys = day.theme.primaryTags.filter((t) => coveredKeys.includes(t));
      const keysToMark = themeKeys.length > 0 ? themeKeys : coveredKeys.slice(0, 1);
      if (keysToMark.length > 0) {
        coverage = markExperienceCompletedByKeys(coverage, keysToMark);
      }
    }

    days.push({
      ...day,
      anchor: toCommittedStop(anchor, "anchor"),
      support: support.map((s) => toCommittedStop(s, "support")),
    });
  }

  return {
    ...blueprint,
    days,
    experienceCoverage: coverage,
    interestQuota: coverage.items.map((i) => ({
      tag: i.tag,
      target: i.target,
      scheduled: i.completed,
    })),
    ledger: {
      ...blueprint.ledger,
      landmarkNames: [...ledgerNames],
      satisfiedInterestTags: coverage.items.filter((i) => i.completed > 0).map((i) => i.tag),
    },
  };
}

export type StagedDayPlacement = {
  ctx: DayLandmarkContext;
  /** Skeleton kinds to drop so we don't double-book the same POI. */
  dropSlotKinds: Array<DayIntent["kind"]>;
};

/**
 * Map committed blueprint stops onto the legacy DayLandmarkContext + slot drops
 * so meal/schedule stages can reuse fillDaySkeleton.
 */
export function placementFromDayBlueprint(
  city: CityConfig,
  plan: TripPlan,
  day: DayBlueprint,
  ledgerNames: Set<string>,
): StagedDayPlacement {
  const anchor =
    (day.anchor && findLandmark(city, day.anchor.landmarkName)) ||
    city.landmarks[0]!;
  const support = day.support
    .map((s) => findLandmark(city, s.landmarkName))
    .filter((l): l is Landmark => Boolean(l));

  const halfDay = day.constraints.some((c) => c.type === "require_half_day_window");
  const maxAct = day.capacity.maxActivitiesPerDay;
  const dropSlotKinds: StagedDayPlacement["dropSlotKinds"] = [];

  let morning: Landmark;
  let afternoon: Landmark;
  let extra: Landmark | undefined;

  if (halfDay) {
    // Theme parks (and other exclusive half-day heroes): no morning companion.
    if (isThemeParkExperience(anchor) || day.theme.id === "theme_park") {
      morning = anchor;
      afternoon = anchor;
      extra = undefined;
      dropSlotKinds.push("extra_activity", "morning_activity");
    } else {
      morning =
        support[0] ??
        selectSoftFiller(
          city,
          plan,
          day,
          anchor,
          ledgerNames,
          supportVisitWindow(plan, day),
          [anchor, ...support],
        ) ??
        anchor;
      afternoon = anchor;
      extra = undefined;
      dropSlotKinds.push("extra_activity");
      if (morning.name === afternoon.name) dropSlotKinds.push("morning_activity");
    }
  } else if (maxAct <= 1 || day.role === "departure") {
    morning = anchor;
    afternoon = anchor;
    dropSlotKinds.push("afternoon_activity", "extra_activity");
  } else {
    morning =
      support[0] ??
      selectSoftFiller(
        city,
        plan,
        day,
        anchor,
        ledgerNames,
        supportVisitWindow(plan, day),
        [anchor, ...support],
      ) ??
      anchor;
    afternoon = anchor;
    extra = support[1];
    if (!extra) dropSlotKinds.push("extra_activity");
    if (morning.name === afternoon.name) dropSlotKinds.push("morning_activity");
    // Packed may request 3 activities — only keep extra when we have a distinct stop
    if (maxAct < 3) dropSlotKinds.push("extra_activity");
  }

  // Relaxed / arrival: respect intensity config afternoon flag via capacity
  if (!getIntensityConfig(plan).includeAfternoonActivity && maxAct <= 1) {
    if (!dropSlotKinds.includes("afternoon_activity")) {
      dropSlotKinds.push("afternoon_activity");
    }
  }

  const dinnerNear =
    shouldIncludeNaps(plan) && !isThemeParkExperience(afternoon)
      ? stayLandmarkForMeals(plan) ?? afternoon
      : afternoon;

  return {
    ctx: {
      morning,
      afternoon,
      lunch: halfDay ? afternoon : morning,
      dinner: dinnerNear,
      extra,
      dayOffset: 0,
    },
    dropSlotKinds: [...new Set(dropSlotKinds)],
  };
}

/** Synthetic landmark so dinner / restaurant picks can score near the stay. */
function stayLandmarkForMeals(plan: TripPlan): Landmark | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return {
    name: (plan.stayAddress ?? "").trim() || "Your stay",
    lat: plan.stayLat,
    lng: plan.stayLng,
    adultPrice: 0,
    intensity: "low",
    ageTags: ["toddler", "child", "tween", "teen"],
    interestTags: [],
    indoor: true,
    openingHours: { open: "00:00", close: "23:59" },
  };
}
