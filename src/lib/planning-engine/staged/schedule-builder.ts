import type { CityConfig, Landmark } from "@/config/city-pricing";
import { getTripDayCount } from "@/lib/itinerary";
import { getAdjustmentContext } from "@/lib/planning-engine/day-adjustment";
import {
  labelForMealIntent,
} from "@/lib/planning-engine/staged/meal-planner";
import {
  placementFromDayBlueprint,
} from "@/lib/planning-engine/staged/fill-stops";
import type { DayBlueprint, MealIntent, MealSlotKind } from "@/lib/planning-engine/staged/types";
import {
  slotActivityType,
  TRIP_START_GROCERY_TITLE,
  tripStartGroceryNotes,
} from "@/lib/planning-engine/meal-planner";
import { buildDaySkeleton } from "@/lib/planning-engine/skeleton-builder";
import type {
  DayIntent,
  DayLandmarkContext,
  RawActivity,
} from "@/lib/planning-engine/types";
import { suggestActivityTitle } from "@/lib/schedule/family-profile";
import { getIntensityConfig } from "@/lib/schedule/travel-style";
import type { TripPlan } from "@/types/trip-plan";

function mealIntentFor(day: DayBlueprint, slot: MealSlotKind): MealIntent | undefined {
  return day.meals.find((m) => m.slot === slot);
}

function fillActivitySlot(
  slot: DayIntent,
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
  ctx: DayLandmarkContext,
  totalDays: number,
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
    case "breakfast":
    case "lunch":
    case "dinner": {
      const intent = mealIntentFor(day, slot.kind);
      const spot =
        slot.kind === "dinner"
          ? ctx.dinner.name
          : slot.kind === "lunch"
            ? ctx.lunch.name
            : ctx.morning.name;
      const meal = intent
        ? labelForMealIntent(intent, plan, city, day.dayIndex, spot)
        : { title: `${slot.kind} near ${spot}`, notes: "" };
      return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
    }
    case "morning_activity":
      return tagged(
        {
          time: slot.defaultTime,
          title: suggestActivityTitle(ctx.morning.name, plan, "morning"),
          type,
        },
        ctx.morning,
      );
    case "afternoon_activity":
      return tagged(
        {
          time: slot.defaultTime,
          title: suggestActivityTitle(ctx.afternoon.name, plan, "afternoon"),
          type,
          notes:
            ctx.afternoon.adultPrice > 0 ? "Paid stop within your family budget." : undefined,
        },
        ctx.afternoon,
      );
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
    case "calm_activity":
      return tagged({
        time: slot.defaultTime,
        title: `Calm family time near ${ctx.afternoon.name}`,
        type,
        notes: "Low-key pace with room to breathe.",
      });
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
    case "grocery":
      return tagged({
        time: slot.defaultTime,
        title: TRIP_START_GROCERY_TITLE,
        type,
        notes: tripStartGroceryNotes(plan, day.dayIndex),
      });
    case "evening_rest": {
      const allYoungKids =
        plan.children.length > 0 && plan.children.every((age) => age <= 7);
      if (allYoungKids) {
        return tagged({
          time: slot.defaultTime,
          title:
            day.dayIndex === totalDays
              ? "Pack up & unwind at your hotel"
              : "Quiet time at your hotel",
          type,
          notes: "Rest at your stay before dinner — better than another walk with little ones.",
        });
      }
      const hour = parseInt(slot.defaultTime.split(":")[0] ?? "17", 10);
      const strollLabel = hour >= 18 ? "Evening stroll" : "Afternoon stroll";
      return tagged({
        time: slot.defaultTime,
        title:
          day.dayIndex === totalDays
            ? "Pack up & unwind"
            : `${strollLabel} near ${ctx.dinner.name}`,
        type,
        notes: "Easy pace before dinner.",
      });
    }
    default:
      return tagged({
        time: slot.defaultTime,
        title: `Family time near ${ctx.afternoon.name}`,
        type,
      });
  }
}

export type StagedDaySchedule = {
  activities: RawActivity[];
  ctx: DayLandmarkContext;
};

/**
 * Build timed activities from committed stops + MealIntent only (no restaurant re-pick).
 * Caller should run fixRawDayActivities for naps / meal-anchor timing.
 */
export function buildScheduleFromBlueprint(
  day: DayBlueprint,
  plan: TripPlan,
  city: CityConfig,
): StagedDaySchedule {
  const totalDays = getTripDayCount(plan.startDate, plan.endDate);
  const adjustment = getAdjustmentContext(undefined, day.dayIndex);
  const ledger = new Set<string>([
    ...(day.anchor ? [day.anchor.landmarkName] : []),
    ...day.support.map((s) => s.landmarkName),
  ]);
  const { ctx, dropSlotKinds } = placementFromDayBlueprint(city, plan, day, ledger);

  let slots = buildDaySkeleton(plan, day.dayIndex, totalDays, adjustment).filter(
    (s) => !dropSlotKinds.includes(s.kind),
  );

  // Theme-park / half-day: no extra stop
  if (
    day.constraints.some((c) => c.type === "require_half_day_window") ||
    ctx.afternoon.interestTags.includes("theme-parks")
  ) {
    slots = slots.filter((s) => s.kind !== "extra_activity");
  }

  // Single-activity days (departure): keep the hero morning/afternoon slot from placement drops
  if (day.capacity.maxActivitiesPerDay <= 1) {
    slots = slots.filter((s) => s.kind !== "extra_activity");
  }

  const activities = slots.map((slot) =>
    fillActivitySlot(slot, day, plan, city, ctx, totalDays),
  );

  return { activities, ctx };
}
