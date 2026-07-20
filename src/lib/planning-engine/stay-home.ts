import { ActivityLocation, ItineraryActivity } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

const HOME_TITLE =
  /\b(cook dinner at your rental|dinner with your hosts|return to|back to (your )?(rental|accommodation|stay|hotel|home)|hotel breakfast|packed breakfast)\b/i;

/** Stay address not required — plan around city center. */
export function isStayNotBookedYet(plan: Pick<TripPlan, "accommodationType">): boolean {
  return plan.accommodationType === "dont_know_yet";
}

/** True when the plan has a usable stay lat/lng (FAM-24). */
export function hasStayHome(plan: TripPlan): boolean {
  return (
    typeof plan.stayLat === "number" &&
    typeof plan.stayLng === "number" &&
    Number.isFinite(plan.stayLat) &&
    Number.isFinite(plan.stayLng)
  );
}

/** Stay pin used as "home" for naps, cook nights, and grocery fallback. */
export function stayHomeLocation(plan: TripPlan): ActivityLocation | null {
  if (!hasStayHome(plan)) return null;
  const name = (plan.stayAddress ?? "").trim() || "Your stay";
  return {
    name,
    lat: plan.stayLat as number,
    lng: plan.stayLng as number,
  };
}

/** Activities that should sit at the stay address when one is known. */
export function activityUsesStayHome(
  activity: Pick<ItineraryActivity, "type" | "title">,
): boolean {
  if (activity.type === "nap" || activity.type === "rest") return true;
  return HOME_TITLE.test(activity.title);
}
