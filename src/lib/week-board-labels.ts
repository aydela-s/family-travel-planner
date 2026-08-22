import type { ItineraryActivity } from "@/types/itinerary";

function mealName(activity: Pick<ItineraryActivity, "title" | "slotKind">): string {
  if (activity.slotKind === "breakfast") return "Breakfast";
  if (activity.slotKind === "lunch") return "Lunch";
  if (activity.slotKind === "dinner") return "Dinner";
  if (/\bbreakfast\b/i.test(activity.title)) return "Breakfast";
  if (/\blunch\b/i.test(activity.title)) return "Lunch";
  if (/\bdinner\b/i.test(activity.title)) return "Dinner";
  return "Meal";
}

function activityName(title: string): string {
  const stripped = title
    .replace(/^(?:Explore|Visit|Family time at|Outdoor time:|Museum & culture:)\s+/i, "")
    .trim();
  return stripped || title;
}

/** Short week-board label: meal type, Nap, or the place name without planner prefixes. */
export function weekBoardStopLabel(activity: Pick<ItineraryActivity, "type" | "title" | "slotKind">): string {
  if (activity.type === "nap") return "Nap";
  if (activity.type === "rest") return /nap/i.test(activity.title) ? "Nap" : "Rest";
  if (activity.type === "meal") return mealName(activity);
  if (activity.type === "travel") return activity.title;
  return activityName(activity.title);
}
