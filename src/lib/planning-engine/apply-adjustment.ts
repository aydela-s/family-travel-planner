import { detectCity } from "@/lib/city-detect";
import { isGroceryActivity, isDinnerMeal } from "@/lib/schedule/meal-planning";
import { parseTimeToMinutes } from "@/lib/schedule/timeline";
import { activityTitleForLandmark, pickAlternateLandmark } from "@/lib/planning-engine/adjust-landmarks";
import { buildDayAdjustContext } from "@/lib/planning-engine/adjust-context";
import { pickRestaurantForMeal } from "@/lib/planning-engine/restaurant-picker";
import {
  AdjustActionId,
  AdjustApplyResult,
  DayAdjustContext,
} from "@/lib/planning-engine/adjust-types";
import { ItineraryDay } from "@/types/itinerary";
import { ActivityType, RawItinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

type RawActivity = RawItinerary["days"][0]["activities"][0];

function cloneActivities(activities: RawActivity[]): RawActivity[] {
  return activities.map((a) => ({ ...a }));
}

function activityIndices(activities: RawActivity[]): number[] {
  return activities
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.type === "activity" && !isGroceryActivity(a))
    .map(({ i }) => i);
}

function findMorningActivityIndex(activities: RawActivity[]): number {
  const indices = activityIndices(activities);
  return indices.find((i) => parseTimeToMinutes(activities[i].time) < 13 * 60) ?? indices[0] ?? -1;
}

function findRemovableActivityIndex(activities: RawActivity[]): number {
  const indices = activityIndices(activities);
  if (indices.length === 0) return -1;
  const afternoon = indices.filter((i) => parseTimeToMinutes(activities[i].time) >= 13 * 60);
  if (afternoon.length > 0) return afternoon[afternoon.length - 1];
  return indices[indices.length - 1];
}

function dinnerIndex(activities: RawActivity[]): number {
  return activities.findIndex(isDinnerMeal);
}

function insertBeforeDinner(activities: RawActivity[], item: RawActivity): RawActivity[] {
  const dIdx = dinnerIndex(activities);
  const insertAt = dIdx >= 0 ? dIdx : activities.length;
  return [...activities.slice(0, insertAt), item, ...activities.slice(insertAt)];
}

function swapActivityTitle(
  activities: RawActivity[],
  index: number,
  title: string,
  notes?: string,
): RawActivity[] {
  return activities.map((a, i) =>
    i === index ? { ...a, title, notes: notes ?? a.notes } : a,
  );
}

function applyFewerActivities(activities: RawActivity[]): AdjustApplyResult {
  const idx = findRemovableActivityIndex(activities);
  if (idx < 0) {
    return { applied: false, message: "Only one activity left on this day", activities };
  }
  return {
    applied: true,
    activities: activities.filter((_, i) => i !== idx),
  };
}

function applyAddActivity(
  activities: RawActivity[],
  plan: TripPlan,
  ctx: DayAdjustContext,
): AdjustApplyResult {
  if (ctx.activityCount >= 3 && ctx.eveningGapMin < 90) {
    return { applied: false, message: "Day is too full to add another stop", activities };
  }
  const city = detectCity(plan.destination);
  const names = activities.filter((a) => a.type === "activity").map((a) => a.title);
  const landmark = pickAlternateLandmark(city, plan, ctx.dayNumber, 3, "default", names);
  const newAct: RawActivity = {
    time: "16:00",
    title: activityTitleForLandmark(landmark.name, plan, "afternoon"),
    type: "activity",
    notes: "Added stop — fits before dinner with travel time.",
  };
  return { applied: true, activities: insertBeforeDinner(activities, newAct) };
}

function applyReplaceMain(
  activities: RawActivity[],
  plan: TripPlan,
  ctx: DayAdjustContext,
): AdjustApplyResult {
  const idx = findMorningActivityIndex(activities);
  if (idx < 0) {
    return { applied: false, message: "No main morning activity to replace", activities };
  }
  const city = detectCity(plan.destination);
  const current = activities[idx].title;
  const landmark = pickAlternateLandmark(city, plan, ctx.dayNumber, 0, "default", [current]);
  return {
    applied: true,
    activities: swapActivityTitle(
      activities,
      idx,
      activityTitleForLandmark(landmark.name, plan, "morning"),
      "Swapped per your request — same time slot, new highlight.",
    ),
  };
}

function applyOutdoor(
  activities: RawActivity[],
  plan: TripPlan,
  ctx: DayAdjustContext,
): AdjustApplyResult {
  const city = detectCity(plan.destination);
  const indices = activityIndices(activities);
  if (indices.length === 0) {
    return { applied: false, message: "No activities to adjust", activities };
  }
  let result = cloneActivities(activities);
  indices.forEach((idx, n) => {
    const landmark = pickAlternateLandmark(city, plan, ctx.dayNumber, n, "outdoor", []);
    const slot = parseTimeToMinutes(result[idx].time) < 13 * 60 ? "morning" : "afternoon";
    result = swapActivityTitle(
      result,
      idx,
      activityTitleForLandmark(landmark.name, plan, slot as "morning" | "afternoon"),
      "Outdoor alternative for more fresh-air time.",
    );
  });
  return { applied: true, activities: result };
}

function applyCookDinner(activities: RawActivity[]): AdjustApplyResult {
  let result = cloneActivities(activities).filter((a) => !isGroceryActivity(a));
  const dIdx = dinnerIndex(result);
  if (dIdx < 0) {
    return { applied: false, message: "No dinner slot found", activities };
  }
  result[dIdx] = {
    ...result[dIdx],
    title: "Cook dinner at your rental",
    type: "meal",
    notes: "Grocery-based dinner at your accommodation.",
  };
  const grocery: RawActivity = {
    time: "17:00",
    title: "Grocery stop for dinner ingredients",
    type: "activity",
    notes: "Pick up ingredients on your way back to cook dinner.",
  };
  result = [...result.slice(0, dIdx), grocery, ...result.slice(dIdx)];
  return { applied: true, activities: result };
}

function applyEatOut(activities: RawActivity[], plan: TripPlan, ctx: DayAdjustContext): AdjustApplyResult {
  const result = cloneActivities(activities).filter((a) => !isGroceryActivity(a));
  const dIdx = dinnerIndex(result);
  if (dIdx < 0) {
    return { applied: false, message: "No dinner slot found", activities };
  }
  const city = detectCity(plan.destination);
  const near = city.landmarks[ctx.dayNumber % city.landmarks.length];
  const restaurant = pickRestaurantForMeal(city, plan, {
    meal: "dinner",
    day: ctx.dayNumber,
    near,
  });
  result[dIdx] = {
    ...result[dIdx],
    title: restaurant ? `Dinner at ${restaurant.name}` : `Dinner out near ${near.name}`,
    type: "meal",
    notes: restaurant
      ? `${restaurant.familyNote} Night off from cooking — enjoy a local restaurant.`
      : "Night off from cooking — enjoy a local restaurant.",
  };
  return { applied: true, activities: result };
}

function applyPlayground(
  activities: RawActivity[],
  plan: TripPlan,
  ctx: DayAdjustContext,
): AdjustApplyResult {
  const city = detectCity(plan.destination);
  const indices = activityIndices(activities).filter((i) => parseTimeToMinutes(activities[i].time) >= 12 * 60);
  const idx = indices[0] ?? findMorningActivityIndex(activities);
  if (idx < 0) {
    return { applied: false, message: "No activity to adjust", activities };
  }
  const landmark = pickAlternateLandmark(city, plan, ctx.dayNumber, 2, "playground", []);
  return {
    applied: true,
    activities: swapActivityTitle(
      activities,
      idx,
      `Playground time: ${landmark.name}`,
      "More play space for little ones.",
    ),
  };
}

function applyEveningActivity(
  activities: RawActivity[],
  plan: TripPlan,
  ctx: DayAdjustContext,
): AdjustApplyResult {
  if (ctx.eveningGapMin < 75) {
    return { applied: false, message: "Not enough time before dinner for another stop", activities };
  }
  const city = detectCity(plan.destination);
  const landmark = pickAlternateLandmark(city, plan, ctx.dayNumber, 4, "default", []);
  const newAct: RawActivity = {
    time: "17:30",
    title: `Evening: ${landmark.name}`,
    type: "activity",
    notes: "Short evening outing before dinner.",
  };
  return { applied: true, activities: insertBeforeDinner(activities, newAct) };
}

export function applyAdjustAction(
  actionId: AdjustActionId,
  plan: TripPlan,
  enrichedDay: ItineraryDay,
  rawActivities: RawActivity[],
): AdjustApplyResult {
  const ctx = buildDayAdjustContext(plan, enrichedDay);
  const activities = cloneActivities(rawActivities);

  switch (actionId) {
    case "fewer_activities":
      return applyFewerActivities(activities);
    case "add_activity":
      return applyAddActivity(activities, plan, ctx);
    case "replace_main_activity":
      return applyReplaceMain(activities, plan, ctx);
    case "more_outdoor_time":
      return applyOutdoor(activities, plan, ctx);
    case "cook_dinner_tonight":
      return applyCookDinner(activities);
    case "eat_out_tonight":
      return applyEatOut(activities, plan, ctx);
    case "more_playground_time":
      return applyPlayground(activities, plan, ctx);
    case "add_evening_activity":
      return applyEveningActivity(activities, plan, ctx);
    case "less_walking":
      return {
        applied: true,
        activities: activities.map((a, i) =>
          i === 0 && a.type === "activity"
            ? {
                ...a,
                notes: a.notes
                  ? `${a.notes} Shorter walks and more rides today.`
                  : "Shorter walks and more rides today.",
              }
            : a,
        ),
        planOverrides: {
          walkingLimit: "low",
          transportationType:
            plan.transportationType === "walking" ? "taxis" : plan.transportationType,
        },
      };
    case "more_walking":
      return {
        applied: true,
        activities: activities.map((a, i) =>
          i === 0 && a.type === "activity"
            ? {
                ...a,
                notes: a.notes
                  ? `${a.notes} More walking between stops today.`
                  : "More walking between stops today.",
              }
            : a,
        ),
        planOverrides: { walkingLimit: "high", transportationType: "walking" },
      };
    default:
      return { applied: false, message: "Unknown adjustment", activities };
  }
}
