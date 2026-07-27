import { CITY_CONFIGS } from "@/config/city-pricing";
import {
  applyDailyThemes,
  buildTripStrategy,
  commitStopsToBlueprint,
  eligibleInterestThemes,
} from "@/lib/planning-engine/staged";
import {
  filterAnchorCandidates,
  scoreAnchorCandidate,
} from "@/lib/planning-engine/staged/anchor-selector";
import { isShorelineBeachExperience } from "@/lib/planning-engine/staged/landmark-experience";
import { haversineKm } from "@/lib/maps/directions";
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
  stayAddress: "Carlton",
  stayLat: 32.7157,
  stayLng: -117.1611,
  dietaryRestrictions: "vegan",
  naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
  budgetStyle: "balanced",
  interests: [
    "Playgrounds & Indoor Play",
    "Interactive Museums",
    "Beaches & Waterfronts",
    "Shows & Entertainment",
  ],
};

const city = CITY_CONFIGS.find((c) => c.id === "san-diego")!;
const eligible = eligibleInterestThemes(plan, city).map((t) => t.id);
const themed = applyDailyThemes(buildTripStrategy(plan, { city }), plan, city);
const committed = commitStopsToBlueprint(themed, plan, city);

process.stdout.write(
  JSON.stringify(
    {
      eligible,
      themes: themed.days.map((d) => d.theme.id),
      coverageTargets: themed.experienceCoverage.items,
      anchors: committed.days.map((d) => ({
        theme: d.theme.id,
        anchor: d.anchor?.landmarkName,
        support: d.support.map((s) => s.landmarkName),
      })),
      coverageDone: committed.experienceCoverage.items.map((i) => ({
        key: i.key,
        completed: i.completed,
        target: i.target,
      })),
      arrivalCandidates: filterAnchorCandidates(city, themed.days[0]!, plan, new Set()).map(
        (l) => ({
          name: l.name,
          km: Number(haversineKm(l.lat, l.lng, plan.stayLat!, plan.stayLng!).toFixed(1)),
          score: Number(scoreAnchorCandidate(l, themed.days[0]!, plan, new Set()).toFixed(1)),
        }),
      ),
      shoreline: city.landmarks.filter(isShorelineBeachExperience).map((l) => l.name),
    },
    null,
    2,
  ),
);
