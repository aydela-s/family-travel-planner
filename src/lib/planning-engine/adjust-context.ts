import { detectCity } from "@/lib/city-detect";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { hasCookDinnerAtHome, isGroceryActivity, isDinnerMeal } from "@/lib/schedule/meal-planning";
import { DayAdjustContext } from "@/lib/planning-engine/adjust-types";
import { ItineraryDay } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

const OUTDOOR = /\b(park|beach|garden|zoo|cove|trail|outdoor|nature)\b/i;

function activityEndMin(a: ItineraryDay["activities"][0]): number {
  if (a.endTime) return parseTimeToMinutes(a.endTime);
  const base = parseTimeToMinutes(a.time);
  if (a.type === "meal") return base + 60;
  if (a.type === "nap") return base + 90;
  if (a.type === "rest") return base + 35;
  if (/\bgrocery\b/i.test(a.title)) return base + 30;
  return base + 90;
}

export function buildDayAdjustContext(plan: TripPlan, day: ItineraryDay): DayAdjustContext {
  const profile = getFamilyAgeProfile(plan);
  const activities = day.activities;
  const activityItems = activities.filter((a) => a.type === "activity" && !isGroceryActivity(a));
  const rawLike = activities.map(({ time, title, type, notes }) => ({ time, title, type, notes }));

  const dinner = activities.find(isDinnerMeal);
  const dinnerStart = dinner ? parseTimeToMinutes(dinner.time) : 18 * 60;
  const lastBeforeDinner = [...activities]
    .filter((a) => !isDinnerMeal(a) && a.type !== "meal")
    .sort((a, b) => activityEndMin(b) - activityEndMin(a))[0];
  const lastEnd = lastBeforeDinner ? activityEndMin(lastBeforeDinner) : 15 * 60;
  const eveningGapMin = Math.max(0, dinnerStart - lastEnd);

  const allOutdoor =
    activityItems.length > 0 &&
    activityItems.every((a) => OUTDOOR.test(a.title) || OUTDOOR.test(a.notes ?? ""));

  return {
    dayNumber: day.day,
    activityCount: activityItems.length,
    hasMorningActivity: activityItems.some((a) => parseTimeToMinutes(a.time) < 12 * 60),
    isCookNight: hasCookDinnerAtHome(rawLike),
    hasGroceryTonight: activities.some(isGroceryActivity),
    isEatOutNight:
      !!dinner &&
      !hasCookDinnerAtHome(rawLike) &&
      /\b(dinner out|dinner in|restaurant)\b/i.test(`${dinner.title} ${dinner.notes ?? ""}`),
    hasKitchen: plan.accommodationType === "airbnb_with_kitchen",
    budgetUsagePercent: day.budgetUsagePercentage ?? 0,
    hasPaidActivities: activities.some((a) => (a.activityCost ?? 0) > 0),
    transportationType: plan.transportationType,
    walkingLimit: plan.walkingLimit,
    daySteps: day.metrics?.steps ?? 0,
    distanceKm: day.metrics?.distanceKm ?? 0,
    youngestChild: profile.youngest,
    oldestChild: profile.oldest,
    eveningGapMin,
    allOutdoorActivities: allOutdoor,
  };
}

export function hasSignificantWalking(ctx: DayAdjustContext): boolean {
  return (
    ctx.transportationType === "walking" ||
    ctx.daySteps >= 8000 ||
    ctx.distanceKm >= 4
  );
}
