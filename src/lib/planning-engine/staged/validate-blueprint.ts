import type { CityConfig, Landmark } from "@/config/city-pricing";
import { restaurantsForCity } from "@/config/city-restaurants";
import { haversineKm } from "@/lib/maps/directions";
import { stayTravelMin } from "@/lib/maps/travel-estimate";
import { travelDayBudget } from "@/config/travel-times";
import {
  exceedsBudgetStyleTicket,
  isChillDayCompanion,
  isHeavyDayLandmark,
  isIndoorPlayExperience,
  isLongShoppingExperience,
  isOutdoorPlayground,
  isBeachThemeAnchor,
  isThemeParkExperience,
  LOW_FRICTION_STAY_KM,
  pairingAllowedForDay,
  sharesDayActivityCategory,
} from "@/lib/planning-engine/staged/landmark-experience";
import type {
  DayBlueprint,
  TripBlueprint,
  ValidationViolation,
} from "@/lib/planning-engine/staged/types";
import type { TripPlan } from "@/types/trip-plan";

function findLandmark(city: CityConfig, name: string | undefined): Landmark | null {
  if (!name) return null;
  return city.landmarks.find((l) => l.name === name) ?? null;
}

function stayKm(landmark: Landmark, plan: TripPlan): number | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return haversineKm(landmark.lat, landmark.lng, plan.stayLat, plan.stayLng);
}

function cityHasRestaurant(city: CityConfig, name: string): boolean {
  return restaurantsForCity(city).some((r) => r.name === name);
}

function anchorMatchesTheme(day: DayBlueprint, anchor: Landmark): boolean {
  if (day.theme.id === "beach") return isBeachThemeAnchor(anchor);
  if (day.theme.id === "play_indoor") return isIndoorPlayExperience(anchor);
  if (day.theme.id === "playgrounds") return isOutdoorPlayground(anchor);
  const primary = day.theme.primaryTags;
  if (primary.length === 0) return true;
  return primary.some((t) => anchor.interestTags.includes(t));
}

function validateDay(
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
): ValidationViolation[] {
  const out: ValidationViolation[] = [];
  const anchor = findLandmark(city, day.anchor?.landmarkName);
  if (!day.anchor || !anchor) {
    out.push({
      code: "missing_anchor",
      message: `Day ${day.dayIndex} has no committed anchor.`,
      day: day.dayIndex,
      repairHint: "regenerate_anchor",
    });
    return out;
  }

  if (day.role === "arrival" || day.role === "departure") {
    const dayBudget = travelDayBudget(plan);
    const stayMin = stayTravelMin(anchor, plan);
    const km = stayKm(anchor, plan);
    // Keep the geographic stay ring even when driving-time estimates improve —
    // Torrey Pines can look "close enough" in minutes while still being far.
    const tooFar =
      (km != null && km > LOW_FRICTION_STAY_KM) ||
      (stayMin != null && stayMin > dayBudget.softMaxMin);
    if (tooFar) {
      out.push({
        code: "travel_day_far",
        message:
          stayMin != null
            ? `${day.role} anchor "${anchor.name}" is ~${stayMin} min from stay (max ${dayBudget.softMaxMin} min).`
            : `${day.role} anchor "${anchor.name}" is ${km!.toFixed(1)} km from stay (max ${LOW_FRICTION_STAY_KM}).`,
        day: day.dayIndex,
        repairHint: "regenerate_anchor",
      });
    }
    if (anchor.adultPrice > 0) {
      out.push({
        code: "travel_day_paid",
        message: `${day.role} anchor "${anchor.name}" requires tickets.`,
        day: day.dayIndex,
        repairHint: "regenerate_anchor",
      });
    }
    if (isThemeParkExperience(anchor)) {
      out.push({
        code: "travel_day_theme_park",
        message: `${day.role} day cannot use theme park "${anchor.name}" — keep it easy near stay.`,
        day: day.dayIndex,
        repairHint: "regenerate_anchor",
      });
    }
  }

  if (day.role === "full" && !anchorMatchesTheme(day, anchor)) {
    out.push({
      code: "theme_mismatch",
      message: `Day ${day.dayIndex} theme "${day.theme.id}" does not match anchor "${anchor.name}".`,
      day: day.dayIndex,
      repairHint: "regenerate_anchor",
    });
  }

  if (day.theme.id === "beach" && !isBeachThemeAnchor(anchor)) {
    out.push({
      code: "beach_not_shoreline",
      message: `Beach day anchor "${anchor.name}" is not a shoreline or family water-play stop.`,
      day: day.dayIndex,
      repairHint: "regenerate_anchor",
    });
  }

  const supportLandmarks = day.support
    .map((s) => findLandmark(city, s.landmarkName))
    .filter((l): l is Landmark => Boolean(l));
  const dayStops = [anchor, ...supportLandmarks];
  const heavyStops = dayStops.filter(isHeavyDayLandmark);
  if (heavyStops.length > 1) {
    out.push({
      code: "double_heavy_day",
      message: `Day ${day.dayIndex} stacks heavy stops "${heavyStops.map((l) => l.name).join('" and "')}".`,
      day: day.dayIndex,
      repairHint: "regenerate_support",
    });
  }

  if (isThemeParkExperience(anchor) && supportLandmarks.length > 0) {
    const nonChill = supportLandmarks.filter((s) => !isChillDayCompanion(s));
    if (nonChill.length > 0) {
      out.push({
        code: "theme_park_not_exclusive",
        message: `Theme park day "${anchor.name}" may only pair with a low-key stop — drop "${nonChill.map((l) => l.name).join(", ")}".`,
        day: day.dayIndex,
        repairHint: "regenerate_support",
      });
    }
  }

  if (
    (day.theme.id === "shopping" || isLongShoppingExperience(anchor)) &&
    supportLandmarks.length > 0
  ) {
    const nonChill = supportLandmarks.filter((s) => !isChillDayCompanion(s));
    if (nonChill.length > 0) {
      out.push({
        code: "shopping_heavy_companion",
        message: `Shopping day "${anchor.name}" may only pair with a low-key stop — drop "${nonChill.map((l) => l.name).join(", ")}".`,
        day: day.dayIndex,
        repairHint: "regenerate_support",
      });
    }
  }

  for (let i = 0; i < dayStops.length; i++) {
    for (let j = i + 1; j < dayStops.length; j++) {
      if (sharesDayActivityCategory(dayStops[i]!, dayStops[j]!)) {
        out.push({
          code: "duplicate_day_category",
          message: `Day ${day.dayIndex} repeats the same activity category with "${dayStops[i]!.name}" and "${dayStops[j]!.name}".`,
          day: day.dayIndex,
          repairHint: "regenerate_support",
        });
      }
    }
  }

  for (const stop of dayStops) {
    if (exceedsBudgetStyleTicket(stop, plan.budgetStyle)) {
      out.push({
        code: "budget_premium_stop",
        message: `"${stop.name}" exceeds the ${plan.budgetStyle || "balanced"} ticket budget.`,
        day: day.dayIndex,
        repairHint: stop === anchor ? "regenerate_anchor" : "regenerate_support",
      });
    }
  }

  for (const support of supportLandmarks) {
    if (!pairingAllowedForDay(anchor, support)) {
      out.push({
        code: isThemeParkExperience(anchor) || isThemeParkExperience(support)
          ? "theme_park_not_exclusive"
          : "incompatible_day_pairing",
        message:
          isThemeParkExperience(anchor) || isThemeParkExperience(support)
            ? `Theme park day cannot pair "${anchor.name}" with "${support.name}".`
            : `Day ${day.dayIndex} pairs incompatible stops "${anchor.name}" and "${support.name}".`,
        day: day.dayIndex,
        repairHint: "regenerate_support",
      });
    }
  }

  for (const meal of day.meals) {
    if (meal.mode === "named_restaurant" && meal.restaurantName) {
      if (!cityHasRestaurant(city, meal.restaurantName)) {
        out.push({
          code: "meal_cross_city",
          message: `Day ${day.dayIndex} ${meal.slot} "${meal.restaurantName}" is not in the ${city.id} catalog.`,
          day: day.dayIndex,
          repairHint: "regenerate_meals",
        });
      }
    }
  }

  return out;
}

/** Soft validation of a committed blueprint — violations drive day-scoped repair. */
export function validateBlueprint(
  blueprint: TripBlueprint,
  plan: TripPlan,
  city: CityConfig,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  for (const day of blueprint.days) {
    violations.push(...validateDay(day, plan, city));
  }
  return violations;
}
