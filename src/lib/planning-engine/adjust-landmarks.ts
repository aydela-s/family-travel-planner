import { CityConfig } from "@/config/city-pricing";
import { familyActivityCost } from "@/lib/pricing/activity-cost";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { suggestActivityTitle } from "@/lib/schedule/family-profile";
import { TripPlan } from "@/types/trip-plan";

const OUTDOOR = /\b(park|beach|garden|zoo|cove|trail|outdoor|nature|historic)\b/i;
const PLAYGROUND = /\b(playground|play|children|kid|family|zoo|aquarium)\b/i;
const INDOOR = /\b(museum|gallery|indoor|science center)\b/i;

function rankLandmarks(
  city: CityConfig,
  plan: TripPlan,
  budgetCapLocal: number,
  filter: (name: string) => boolean,
  sort: "cheap" | "premium" | "default",
) {
  const pool = city.landmarks.filter((l) => filter(l.name));
  const landmarks = pool.length > 0 ? pool : city.landmarks;

  return [...landmarks]
    .map((landmark) => ({
      landmark,
      cost: familyActivityCost(landmark.adultPrice, plan.adults, plan.children),
    }))
    .filter((r) => r.cost <= budgetCapLocal * 0.5)
    .sort((a, b) => {
      if (sort === "cheap") return a.landmark.adultPrice - b.landmark.adultPrice;
      if (sort === "premium") return b.landmark.adultPrice - a.landmark.adultPrice;
      return 0;
    });
}

export function pickAlternateLandmark(
  city: CityConfig,
  plan: TripPlan,
  dayNumber: number,
  slotIndex: number,
  budgetCapLocal: number,
  mode: "default" | "outdoor" | "playground" | "cheap" | "premium",
  excludeNames: string[] = [],
): CityConfig["landmarks"][0] {
  const offset = dayNumber * 3 + slotIndex + excludeNames.length + 1;
  let ranked;

  switch (mode) {
    case "outdoor":
      ranked = rankLandmarks(city, plan, budgetCapLocal, (n) => OUTDOOR.test(n) && !INDOOR.test(n), "default");
      break;
    case "playground":
      ranked = rankLandmarks(
        city,
        plan,
        budgetCapLocal,
        (n) => PLAYGROUND.test(n) || OUTDOOR.test(n),
        "default",
      );
      break;
    case "cheap":
      ranked = rankLandmarks(city, plan, budgetCapLocal, () => true, "cheap");
      break;
    case "premium":
      ranked = rankLandmarks(city, plan, budgetCapLocal, () => true, "premium");
      break;
    default:
      ranked = rankLandmarks(city, plan, budgetCapLocal, () => true, "default");
  }

  const available = ranked.filter((r) => !excludeNames.includes(r.landmark.name));
  const pick = (available.length > 0 ? available : ranked)[offset % Math.max(1, (available.length || ranked.length))];
  return pick.landmark;
}

export function activityTitleForLandmark(
  landmarkName: string,
  plan: TripPlan,
  slot: "morning" | "afternoon" | "evening",
): string {
  return suggestActivityTitle(landmarkName, plan, slot === "evening" ? "afternoon" : slot);
}
