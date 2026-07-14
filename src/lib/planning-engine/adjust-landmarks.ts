import { CityConfig } from "@/config/city-pricing";
import { landmarksForStyle } from "@/lib/pricing/budget-style";
import { suggestActivityTitle } from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

const OUTDOOR = /\b(park|beach|garden|zoo|cove|trail|outdoor|nature|historic)\b/i;
const PLAYGROUND = /\b(playground|play|children|kid|family|zoo|aquarium)\b/i;
const INDOOR = /\b(museum|gallery|indoor|science center)\b/i;

function rankLandmarks(
  city: CityConfig,
  plan: TripPlan,
  filter: (name: string) => boolean,
) {
  const pool = city.landmarks.filter((l) => filter(l.name));
  const landmarks = pool.length > 0 ? pool : city.landmarks;
  return landmarksForStyle(landmarks, (l) => l.adultPrice, plan.budgetStyle);
}

export function pickAlternateLandmark(
  city: CityConfig,
  plan: TripPlan,
  dayNumber: number,
  slotIndex: number,
  mode: "default" | "outdoor" | "playground",
  excludeNames: string[] = [],
): CityConfig["landmarks"][0] {
  const offset = dayNumber * 3 + slotIndex + excludeNames.length + 1;
  let ranked;

  switch (mode) {
    case "outdoor":
      ranked = rankLandmarks(city, plan, (n) => OUTDOOR.test(n) && !INDOOR.test(n));
      break;
    case "playground":
      ranked = rankLandmarks(city, plan, (n) => PLAYGROUND.test(n) || OUTDOOR.test(n));
      break;
    default:
      ranked = rankLandmarks(city, plan, () => true);
  }

  const available = ranked.filter((l) => !excludeNames.includes(l.name));
  const pick = (available.length > 0 ? available : ranked)[offset % Math.max(1, (available.length || ranked.length))];
  return pick;
}

export function activityTitleForLandmark(
  landmarkName: string,
  plan: TripPlan,
  slot: "morning" | "afternoon" | "evening",
): string {
  return suggestActivityTitle(landmarkName, plan, slot === "evening" ? "afternoon" : slot);
}
