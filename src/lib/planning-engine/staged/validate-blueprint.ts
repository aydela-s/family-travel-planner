import type { CityConfig, Landmark } from "@/config/city-pricing";
import { restaurantsForCityId } from "@/config/city-restaurants";
import { haversineKm } from "@/lib/maps/directions";
import {
  isIndoorPlayExperience,
  isOutdoorPlayground,
  isShorelineBeachExperience,
  LOW_FRICTION_STAY_KM,
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
  return restaurantsForCityId(city.id).some((r) => r.name === name);
}

function anchorMatchesTheme(day: DayBlueprint, anchor: Landmark): boolean {
  if (day.theme.id === "beach") return isShorelineBeachExperience(anchor);
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
    const km = stayKm(anchor, plan);
    if (km != null && km > LOW_FRICTION_STAY_KM) {
      out.push({
        code: "travel_day_far",
        message: `${day.role} anchor "${anchor.name}" is ${km.toFixed(1)} km from stay (max ${LOW_FRICTION_STAY_KM}).`,
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
  }

  if (day.role === "full" && !anchorMatchesTheme(day, anchor)) {
    out.push({
      code: "theme_mismatch",
      message: `Day ${day.dayIndex} theme "${day.theme.id}" does not match anchor "${anchor.name}".`,
      day: day.dayIndex,
      repairHint: "regenerate_anchor",
    });
  }

  if (day.theme.id === "beach" && !isShorelineBeachExperience(anchor)) {
    out.push({
      code: "beach_not_shoreline",
      message: `Beach day anchor "${anchor.name}" is not a shoreline experience.`,
      day: day.dayIndex,
      repairHint: "regenerate_anchor",
    });
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
