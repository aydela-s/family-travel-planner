import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  applyDailyThemes,
  budgetIntentForFullDay,
  buildTripStrategy,
  eligibleInterestThemes,
  scoreTheme,
} from "@/lib/planning-engine/staged";
import type { TripPlan } from "@/types/trip-plan";

const plan: TripPlan = {
  destination: "San Diego",
  startDate: "2026-07-28",
  endDate: "2026-08-01",
  adults: 1,
  children: [4, 8],
  travelStyle: "balanced",
  walkingLimit: "medium",
  transportationType: "car-rental",
  accommodationType: "hotel_breakfast_included",
  stayLat: 32.7157,
  stayLng: -117.1611,
  naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
  dietaryRestrictions: "",
  budgetStyle: "balanced",
  interests: [
    "Indoor & Outdoor Play",
    "Interactive Museums",
    "Swimming & Water Play",
    "Shows & Entertainment",
  ],
};

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
const strategy = buildTripStrategy(plan, { city });
const eligible = eligibleInterestThemes(plan, city);
const reserved = new Map();
const lines: string[] = [];
for (const theme of eligible) {
  const intent = budgetIntentForFullDay(plan, 0, false, theme.typicallyPaid);
  const b = scoreTheme(theme, {
    plan,
    coverage: strategy.experienceCoverage,
    reserved,
    dayBudgetIntent: intent,
    previousThemeId: "arrival",
  });
  lines.push(
    `${theme.id} intent=${intent} total=${b.total.toFixed(4)} cov=${b.coverageNeed} age=${b.ageFit} budget=${b.budgetFit} pace=${b.paceFit} var=${b.varietyBonus}`,
  );
}
const themed = applyDailyThemes(strategy, plan, city);
lines.push(`FINAL ${themed.days.map((d) => d.theme.id).join(",")}`);
require("fs").writeFileSync("nap-check.txt", lines.join("\n"));
