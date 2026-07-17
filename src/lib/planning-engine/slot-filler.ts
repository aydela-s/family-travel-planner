import { CityConfig } from "@/config/city-pricing";
import {
  activityNoteForFamily,
  pickLandmarkForFamily,
  suggestActivityTitle,
  VisitWindow,
} from "@/lib/schedule/family-profile";
import { morningActivityDefaultTime } from "@/lib/planning-engine/skeleton-builder";
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
  slotActivityType,
} from "@/lib/planning-engine/meal-planner";
import { DayLandmarkContext, RawActivity, DayIntent } from "@/lib/planning-engine/types";
import { TripPlan } from "@/types/trip-plan";

function visitWindowFromTime(startTime: string, durationMin: number): VisitWindow {
  const startMin = parseTimeToMinutes(startTime);
  return { startMin, endMin: startMin + durationMin };
}

export function buildLandmarkContext(
  city: CityConfig,
  plan: TripPlan,
  day: number,
  totalDays: number,
  adjustNote?: string,
): DayLandmarkContext {
  const adjustment = getAdjustmentContext(adjustNote, day);
  const offset = day + adjustment.landmarkOffset;
  const activityMins = getIntensityConfig(plan).activityDurationMin;
  const morningWindow = visitWindowFromTime(morningActivityDefaultTime(plan), activityMins);
  const afternoonWindow = visitWindowFromTime("15:30", activityMins);
  const extraWindow = visitWindowFromTime("16:15", activityMins);

  const morning = pickLandmarkForFamily(city, plan, offset, 0, [], morningWindow);
  const afternoon = pickLandmarkForFamily(city, plan, offset, 1, [morning], afternoonWindow);
  const extra = pickLandmarkForFamily(city, plan, offset, 2, [morning, afternoon], extraWindow);
  const lunch = pickLandmarkForFamily(city, plan, offset, 3, [morning, afternoon]);
  const dinner = pickLandmarkForFamily(city, plan, offset, 4, [morning, afternoon, lunch]);

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
  ctx: DayLandmarkContext,
  day: number,
  totalDays: number,
  adjustment: AdjustmentContext,
): RawActivity {
  const type = slotActivityType(slot.kind);
  const intensity = getIntensityConfig(plan);
  const tagged = (
    activity: Omit<RawActivity, "slotKind" | "landmarkIntensity">,
    landmarkIntensity?: RawActivity["landmarkIntensity"],
  ): RawActivity => ({
    ...activity,
    slotKind: slot.kind,
    ...(landmarkIntensity ? { landmarkIntensity } : {}),
  });

  switch (slot.kind) {
    case "breakfast": {
      const meal = breakfastLabel(plan, ctx.morning.name);
      return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
    }
    case "morning_activity": {
      const base = suggestActivityTitle(ctx.morning.name, plan, "morning");
      const notes = activityNoteForFamily(plan, day);
      return tagged(
        {
          time: slot.defaultTime,
          title: activityTitlePrefix(adjustment, base),
          type,
          notes: adjustment.summaryNote
            ? `${notes} Tailored to your request: ${adjustment.summaryNote}`
            : notes,
        },
        ctx.morning.intensity,
      );
    }
    case "lunch": {
      const meal = lunchLabel(plan, ctx.lunch.name);
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
          ? "Extra downtime after a high-energy morning stop."
          : intensity.longBreak
            ? "Extra downtime for a relaxed family pace."
            : "Stretch, shade, and recharge before the afternoon.",
      });
    }
    case "afternoon_rest":
      return tagged({
        time: slot.defaultTime,
        title: "Free time & low-key exploring",
        type,
        notes: "Unstructured time — no rushing between stops.",
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
              ? "A worthwhile paid stop — balanced within your daily family budget."
              : plan.walkingLimit === "low"
                ? "Short walks, stroller-friendly routes."
                : "Light exploring between stops.",
        },
        ctx.afternoon.intensity,
      );
    case "calm_activity":
      return tagged({
        time: slot.defaultTime,
        title: `Calm family time near ${ctx.afternoon.name}`,
        type: "rest",
        notes: "Low-key exploring, shade, and room to breathe — relaxed pace.",
      });
    case "extra_activity":
      return tagged(
        {
          time: slot.defaultTime,
          title: suggestActivityTitle(ctx.extra?.name ?? ctx.afternoon.name, plan, "afternoon"),
          type,
          notes: "Extra stop for a packed day — still family-friendly pacing.",
        },
        (ctx.extra ?? ctx.afternoon).intensity,
      );
    case "grocery":
      return tagged({
        time: slot.defaultTime,
        title: "Grocery stop for dinner ingredients",
        type,
        notes: "Pick up ingredients on your way back to the rental to cook dinner.",
      });
    case "evening_rest":
      return tagged({
        time: slot.defaultTime,
        title: day === totalDays ? "Pack up & unwind" : `Evening stroll near ${ctx.dinner.name}`,
        type,
        notes: "No overpacking — room to breathe.",
      });
    case "dinner": {
      const meal = dinnerLabel(plan, ctx.dinner.name, day, adjustment);
      return tagged({ time: slot.defaultTime, title: meal.title, type, notes: meal.notes });
    }
    default:
      return tagged({ time: slot.defaultTime, title: "Family time", type: "rest" });
  }
}

export function fillDaySkeleton(
  slots: DayIntent[],
  plan: TripPlan,
  ctx: DayLandmarkContext,
  day: number,
  totalDays: number,
  adjustNote?: string,
): RawActivity[] {
  const adjustment = getAdjustmentContext(adjustNote, day);
  return slots.map((slot) => fillSlot(slot, plan, ctx, day, totalDays, adjustment));
}
