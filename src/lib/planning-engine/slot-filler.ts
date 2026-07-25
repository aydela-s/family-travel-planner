import { CityConfig, Landmark, LandmarkAgeTag, OnSiteMeal } from "@/config/city-pricing";
import { addDays } from "@/lib/format";
import {
  getFamilyAgeProfile,
  pickLandmarkForFamily,
  suggestActivityTitle,
  uncoveredAgeBands,
  VisitWindow,
} from "@/lib/schedule/family-profile";
import { morningActivityDefaultTime } from "@/lib/planning-engine/skeleton-builder";
import { getNapWindow, overlapsStrollerNap, shouldIncludeNaps } from "@/lib/schedule/nap-policy";
import { minutesToTime } from "@/lib/schedule/timeline";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import {
  activityTitlePrefix,
  AdjustmentContext,
  getAdjustmentContext,
} from "@/lib/planning-engine/day-adjustment";
import {
  breakfastLabel,
  dinnerLabel,
  lunchLabel,
  napOverlapsLunchWindow,
  onSiteCafeLabel,
  slotActivityType,
  usesNamedRestaurant,
} from "@/lib/planning-engine/meal-planner";
import {
  parseDietaryTags,
  pickRestaurantForMeal,
} from "@/lib/planning-engine/restaurant-picker";
import { DayLandmarkContext, RawActivity, DayIntent } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";

function visitWindowFromTime(
  startTime: string,
  durationMin: number,
  visitDate: string,
): VisitWindow {
  const startMin = parseTimeToMinutes(startTime);
  return { startMin, endMin: startMin + durationMin, visitDate };
}

function landmarkWithOnSiteMeal(
  landmarks: Array<Landmark | undefined>,
  meal: OnSiteMeal,
): Landmark | null {
  for (const landmark of landmarks) {
    if (landmark?.onSiteMeals?.includes(meal)) return landmark;
  }
  return null;
}

/**
 * On-site café is a convenience for light meals — not when we should name a
 * restaurant (splurge / balanced dinner), honor dietary picks, or keep save dinner casual.
 */
function shouldPreferOnSiteCafe(plan: TripPlan, meal: OnSiteMeal): boolean {
  if (parseDietaryTags(plan.dietaryRestrictions).length > 0) return false;
  if (usesNamedRestaurant(plan, meal)) return false;
  if (meal === "dinner" && plan.budgetStyle === "save") return false;
  if (meal === "lunch" && plan.accommodationType === "airbnb_with_kitchen") return false;
  return true;
}

/** Rotate preferred bands so mixed-age days cover toddler, tween, teen, etc. */
function nextPreferBand(
  profile: ReturnType<typeof getFamilyAgeProfile>,
  already: Parameters<typeof uncoveredAgeBands>[1],
  day: number,
  slot: number,
): LandmarkAgeTag | null {
  if (!profile.isMixedAges || profile.bands.length === 0) return null;
  const missing = uncoveredAgeBands(profile, already);
  if (missing.length > 0) return missing[0]!;
  return profile.bands[(day + slot) % profile.bands.length]!;
}

export function buildLandmarkContext(
  city: CityConfig,
  plan: TripPlan,
  day: number,
  totalDays: number,
  adjustNote?: string,
  usedLandmarks: Set<string> = new Set(),
): DayLandmarkContext {
  const adjustment = getAdjustmentContext(adjustNote, day);
  const offset = day + adjustment.landmarkOffset;
  const activityMins = getIntensityConfig(plan).activityDurationMin;
  const visitDate = addDays(plan.startDate, day - 1);
  const morningWindow = visitWindowFromTime(
    morningActivityDefaultTime(plan),
    activityMins,
    visitDate,
  );
  // When a nap is scheduled, afternoon openness checks must use the post-nap window
  // (not a fixed 15:30) or museums that close mid-afternoon get wrongly filtered out.
  const nap = shouldIncludeNaps(plan) ? getNapWindow(plan) : null;
  const afternoonStart = nap
    ? minutesToTime(Math.min(nap.endMin + 15, 16 * 60))
    : "13:15";
  // Theme parks need a long open window from post-lunch through late afternoon.
  const afternoonDurationMin = Math.max(activityMins, 240);
  const afternoonWindow = visitWindowFromTime(afternoonStart, afternoonDurationMin, visitDate);
  const extraWindow = visitWindowFromTime(
    nap ? minutesToTime(Math.min(nap.endMin + 15 + activityMins + 15, 17 * 60)) : "16:15",
    activityMins,
    visitDate,
  );
  const profile = getFamilyAgeProfile(plan);
  const excludeNames = usedLandmarks;

  const morning = pickLandmarkForFamily(city, plan, offset, 0, [], {
    visitWindow: morningWindow,
    preferBand: nextPreferBand(profile, [], day, 0),
    anchorToStay: true,
    excludeNames,
    strollerQuiet: overlapsStrollerNap(plan, morningWindow.startMin, morningWindow.endMin),
  });
  const afternoon = pickLandmarkForFamily(city, plan, offset, 1, [morning], {
    visitWindow: afternoonWindow,
    preferBand: nextPreferBand(profile, [morning], day, 1),
    excludeNames,
    strollerQuiet: overlapsStrollerNap(plan, afternoonWindow.startMin, afternoonWindow.endMin),
  });
  // Theme parks are half-day — don't stack a third stop on the same day.
  const themeDay =
    morning.interestTags.includes("theme-parks") ||
    afternoon.interestTags.includes("theme-parks");
  const extra = themeDay
    ? undefined
    : pickLandmarkForFamily(city, plan, offset, 2, [morning, afternoon], {
        visitWindow: extraWindow,
        preferBand: nextPreferBand(profile, [morning, afternoon], day, 2),
        excludeNames,
        strollerQuiet: overlapsStrollerNap(plan, extraWindow.startMin, extraWindow.endMin),
      });
  // Theme-park afternoons are half-day: lunch at/near the park so the visit
  // starts right after lunch instead of after a cross-city transfer.
  const themeAfternoon = afternoon.interestTags.includes("theme-parks");
  const lunch = themeAfternoon ? afternoon : morning;
  const dinner = afternoon;

  usedLandmarks.add(morning.name);
  usedLandmarks.add(afternoon.name);
  if (extra) usedLandmarks.add(extra.name);

  return {
    morning,
    afternoon,
    lunch,
    dinner,
    extra,
    dayOffset: adjustment.landmarkOffset,
  };
}

function fillSlot(
  slot: DayIntent,
  plan: TripPlan,
  city: CityConfig,
  ctx: DayLandmarkContext,
  day: number,
  totalDays: number,
  adjustment: AdjustmentContext,
  usedRestaurants: Set<string>,
): RawActivity {
  const type = slotActivityType(slot.kind);
  const intensity = getIntensityConfig(plan);
  const tagged = (
    activity: Omit<RawActivity, "slotKind" | "landmarkIntensity" | "interestTags">,
    landmark?: Pick<Landmark, "intensity" | "interestTags">,
  ): RawActivity => ({
    ...activity,
    slotKind: slot.kind,
    ...(landmark?.intensity ? { landmarkIntensity: landmark.intensity } : {}),
    ...(landmark?.interestTags?.length ? { interestTags: landmark.interestTags } : {}),
  });

  switch (slot.kind) {
    case "breakfast": {
      const onSite = shouldPreferOnSiteCafe(plan, "breakfast")
        ? landmarkWithOnSiteMeal([ctx.morning], "breakfast")
        : null;
      if (onSite) {
        const meal = onSiteCafeLabel("breakfast", onSite.name);
        return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
      }
      const restaurant = usesNamedRestaurant(plan, "breakfast")
        ? pickRestaurantForMeal(city, plan, {
            meal: "breakfast",
            day,
            near: ctx.morning,
            excludeNames: usedRestaurants,
          })
        : null;
      if (restaurant) usedRestaurants.add(restaurant.name);
      const meal = breakfastLabel(plan, ctx.morning.name, restaurant);
      return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
    }
    case "morning_activity": {
      const base = suggestActivityTitle(ctx.morning.name, plan, "morning");
      return tagged(
        {
          time: slot.defaultTime,
          title: activityTitlePrefix(adjustment, base),
          type,
          ...(adjustment.summaryNote
            ? { notes: `Tailored to your request: ${adjustment.summaryNote}` }
            : {}),
        },
        ctx.morning,
      );
    }
    case "lunch": {
      if (napOverlapsLunchWindow(plan)) {
        const meal = lunchLabel(plan, ctx.lunch.name, null);
        return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
      }
      const onSite = shouldPreferOnSiteCafe(plan, "lunch")
        ? landmarkWithOnSiteMeal([ctx.morning, ctx.lunch], "lunch")
        : null;
      if (onSite) {
        const meal = onSiteCafeLabel("lunch", onSite.name);
        return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
      }
      const restaurant = usesNamedRestaurant(plan, "lunch")
        ? pickRestaurantForMeal(city, plan, {
            meal: "lunch",
            day,
            near: ctx.lunch,
            excludeNames: usedRestaurants,
          })
        : null;
      if (restaurant) usedRestaurants.add(restaurant.name);
      const meal = lunchLabel(plan, ctx.lunch.name, restaurant);
      return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
    }
    case "midday_rest": {
      const recovery = ctx.morning.intensity === "high";
      return tagged({
        time: slot.defaultTime,
        title: intensity.longBreak
          ? `Slow midday break near ${ctx.afternoon.name}`
          : recovery
            ? `Recovery break near ${ctx.afternoon.name}`
            : `Break at ${ctx.afternoon.name}`,
        type,
        notes: recovery
          ? "Extra downtime after a high-energy morning."
          : intensity.longBreak
            ? "Extra downtime for a relaxed pace."
            : "Quick recharge before the afternoon.",
      });
    }
    case "afternoon_rest":
      return tagged({
        time: slot.defaultTime,
        title: "Free time & low-key exploring",
        type,
        notes: "Unstructured time between stops.",
      });
    case "afternoon_activity":
      return tagged(
        {
          time: slot.defaultTime,
          title: activityTitlePrefix(
            adjustment,
            suggestActivityTitle(ctx.afternoon.name, plan, "afternoon"),
          ),
          type,
          notes:
            ctx.afternoon.adultPrice > 0
              ? "Paid stop within your family budget."
              : plan.walkingLimit === "low"
                ? "Short walks, stroller-friendly."
                : "Light exploring between stops.",
        },
        ctx.afternoon,
      );
    case "calm_activity":
      return tagged({
        time: slot.defaultTime,
        title: `Calm family time near ${ctx.afternoon.name}`,
        type,
        notes: "Low-key pace with room to breathe.",
      });
    case "extra_activity":
      return tagged(
        {
          time: slot.defaultTime,
          title: suggestActivityTitle(ctx.extra?.name ?? ctx.afternoon.name, plan, "afternoon"),
          type,
          notes: "Extra stop for a packed day.",
        },
        ctx.extra ?? ctx.afternoon,
      );
    case "grocery":
      return tagged({
        time: slot.defaultTime,
        title: "Grocery stop for dinner ingredients",
        type,
        notes: "Pick up ingredients on the way back.",
      });
    case "evening_rest": {
      // All-young-kid trips: stay-based downtime — don't invent another walking landmark.
      const allYoungKids =
        plan.children.length > 0 && plan.children.every((age) => age <= 7);
      if (allYoungKids) {
        return tagged({
          time: slot.defaultTime,
          title: day === totalDays ? "Pack up & unwind at your hotel" : "Quiet time at your hotel",
          type,
          notes: "Rest at your stay before dinner — better than another walk with little ones.",
        });
      }
      const hour = parseInt(slot.defaultTime.split(":")[0] ?? "17", 10);
      const strollLabel = hour >= 18 ? "Evening stroll" : "Afternoon stroll";
      return tagged({
        time: slot.defaultTime,
        title: day === totalDays ? "Pack up & unwind" : `${strollLabel} near ${ctx.dinner.name}`,
        type,
        notes: "Easy pace before dinner.",
      });
    }
    case "dinner": {
      const onSite = shouldPreferOnSiteCafe(plan, "dinner")
        ? landmarkWithOnSiteMeal([ctx.afternoon, ctx.dinner, ctx.extra], "dinner")
        : null;
      if (onSite) {
        const meal = onSiteCafeLabel("dinner", onSite.name);
        return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
      }
      const restaurant = pickRestaurantForMeal(city, plan, {
        meal: "dinner",
        day,
        near: ctx.dinner,
        excludeNames: usedRestaurants,
      });
      if (restaurant) usedRestaurants.add(restaurant.name);
      const meal = dinnerLabel(plan, ctx.dinner.name, day, adjustment, restaurant);
      return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
    }
    default:
      return tagged({ time: slot.defaultTime, title: "Family time", type: "activity" });
  }
}

export function fillDaySkeleton(
  slots: DayIntent[],
  plan: TripPlan,
  city: CityConfig,
  ctx: DayLandmarkContext,
  day: number,
  totalDays: number,
  adjustNote?: string,
  usedRestaurants: Set<string> = new Set(),
): RawActivity[] {
  const adjustment = getAdjustmentContext(adjustNote, day);
  const themeDay =
    ctx.morning.interestTags.includes("theme-parks") ||
    ctx.afternoon.interestTags.includes("theme-parks");
  const effectiveSlots =
    themeDay || !ctx.extra
      ? slots.filter((s) => s.kind !== "extra_activity")
      : slots;
  return effectiveSlots.map((slot) =>
    fillSlot(slot, plan, city, ctx, day, totalDays, adjustment, usedRestaurants),
  );
}
