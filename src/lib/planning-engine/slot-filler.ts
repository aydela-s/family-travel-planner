import { CityConfig } from "@/config/city-pricing";
import { getBudgetContext } from "@/lib/pricing/budget";
import {
  activityNoteForFamily,
  pickLandmarkForFamily,
  suggestActivityTitle,
} from "@/lib/schedule/family-profile";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import {
  activityTitlePrefix,
  AdjustmentContext,
  getAdjustmentContext,
} from "@/lib/planning-engine/day-adjustment";
import {
  breakfastLabel,
  dinnerLabel,
  lunchLabel,
  slotActivityType,
} from "@/lib/planning-engine/meal-planner";
import { DayLandmarkContext, RawActivity, SkeletonSlot } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";

export function buildLandmarkContext(
  city: CityConfig,
  plan: TripPlan,
  day: number,
  totalDays: number,
  adjustNote?: string,
): DayLandmarkContext {
  const adjustment = getAdjustmentContext(adjustNote, day);
  const offset = day + adjustment.landmarkOffset;
  const { budgetCapLocal } = getBudgetContext(plan, city);
  const budgetLabel = `${city.currencySymbol}${budgetCapLocal}`;

  return {
    morning: pickLandmarkForFamily(city, plan, offset, 0, budgetCapLocal),
    afternoon: pickLandmarkForFamily(city, plan, offset, 1, budgetCapLocal),
    lunch: city.landmarks[(day + Math.floor(totalDays / 2) + adjustment.landmarkOffset) % city.landmarks.length],
    dinner: city.landmarks[(day + 2 + adjustment.landmarkOffset) % city.landmarks.length],
    extra: pickLandmarkForFamily(city, plan, offset, 2, budgetCapLocal),
    budgetLabel,
    dayOffset: adjustment.landmarkOffset,
  };
}

function fillSlot(
  slot: SkeletonSlot,
  plan: TripPlan,
  ctx: DayLandmarkContext,
  day: number,
  totalDays: number,
  adjustment: AdjustmentContext,
): RawActivity {
  const type = slotActivityType(slot.kind);
  const intensity = getIntensityConfig(plan);

  switch (slot.kind) {
    case "breakfast": {
      const meal = breakfastLabel(plan, ctx.morning.name);
      return { time: slot.defaultTime, title: meal.title, type, notes: meal.notes };
    }
    case "morning_activity": {
      const base = suggestActivityTitle(ctx.morning.name, plan, "morning");
      const notes = activityNoteForFamily(plan, day);
      return {
        time: slot.defaultTime,
        title: activityTitlePrefix(adjustment, base),
        type,
        notes: adjustment.summaryNote
          ? `${notes} Tailored to your request: ${adjustment.summaryNote}`
          : notes,
      };
    }
    case "lunch": {
      const meal = lunchLabel(plan, ctx.lunch.name);
      return { time: slot.defaultTime, title: meal.title, type, notes: meal.notes };
    }
    case "midday_rest":
      return {
        time: slot.defaultTime,
        title: intensity.longBreak
          ? `Slow midday break near ${ctx.afternoon.name}`
          : `Break at ${ctx.afternoon.name}`,
        type,
        notes: intensity.longBreak
          ? "Extra downtime for a relaxed family pace."
          : "Stretch, shade, and recharge before the afternoon.",
      };
    case "afternoon_rest":
      return {
        time: slot.defaultTime,
        title: "Free time & low-key exploring",
        type,
        notes: "Unstructured time — no rushing between stops.",
      };
    case "afternoon_activity":
      return {
        time: slot.defaultTime,
        title: activityTitlePrefix(
          adjustment,
          suggestActivityTitle(ctx.afternoon.name, plan, "afternoon"),
        ),
        type,
        notes:
          ctx.afternoon.adultPrice > 0
            ? "A worthwhile paid stop — balanced within your daily family budget."
            : plan.walkingLimit === "low"
              ? "Short walks, stroller-friendly routes."
              : "Light exploring between stops.",
      };
    case "calm_activity":
      return {
        time: slot.defaultTime,
        title: `Calm family time near ${ctx.afternoon.name}`,
        type: "rest",
        notes: "Low-key exploring, shade, and room to breathe — relaxed pace.",
      };
    case "extra_activity":
      return {
        time: slot.defaultTime,
        title: suggestActivityTitle(ctx.extra?.name ?? ctx.afternoon.name, plan, "afternoon"),
        type,
        notes: "Extra stop for a packed day — still family-friendly pacing.",
      };
    case "grocery":
      return {
        time: slot.defaultTime,
        title: "Grocery stop for dinner ingredients",
        type,
        notes: "Pick up ingredients on your way back to the rental to cook dinner.",
      };
    case "evening_rest":
      return {
        time: slot.defaultTime,
        title: day === totalDays ? "Pack up & unwind" : `Evening stroll near ${ctx.dinner.name}`,
        type,
        notes: "No overpacking — room to breathe.",
      };
    case "dinner": {
      const meal = dinnerLabel(plan, ctx.dinner.name, ctx.budgetLabel, day, adjustment);
      return { time: slot.defaultTime, title: meal.title, type, notes: meal.notes };
    }
    default:
      return { time: slot.defaultTime, title: "Family time", type: "rest" };
  }
}

export function fillDaySkeleton(
  slots: SkeletonSlot[],
  plan: TripPlan,
  ctx: DayLandmarkContext,
  day: number,
  totalDays: number,
  adjustNote?: string,
): RawActivity[] {
  const adjustment = getAdjustmentContext(adjustNote, day);
  return slots.map((slot) => fillSlot(slot, plan, ctx, day, totalDays, adjustment));
}
