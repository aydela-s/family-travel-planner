import { PRICING_DISCLAIMER } from "@/config/city-pricing";
import type {
  ActivityLocation,
  DayCostBreakdown,
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
  RouteSegment,
} from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

const STAY: ActivityLocation = {
  name: "Sister’s house, Lakewood",
  lat: 32.8215,
  lng: -96.7503,
};

const PEROT: ActivityLocation = {
  name: "Perot Museum of Nature and Science",
  lat: 32.7868,
  lng: -96.8063,
};

const WE_ROCK: ActivityLocation = {
  name: "We Rock the Spectrum",
  lat: 32.9094,
  lng: -96.7692,
};

const HEIGHTS: ActivityLocation = {
  name: "Heights Family Aquatic Center",
  lat: 32.8072,
  lng: -96.8271,
};

const MILLS: ActivityLocation = {
  name: "Grapevine Mills",
  lat: 32.9687,
  lng: -97.0423,
};

const TAKEOFF: ActivityLocation = {
  name: "Takeoff Adventure Park",
  lat: 32.9911,
  lng: -96.8414,
};

export const DALLAS_PLAN: TripPlan = {
  destination: "Dallas, TX, USA",
  destinationPlaceId: "design-lab-dallas",
  destinationLat: 32.7767,
  destinationLng: -96.797,
  startDate: "2026-08-24",
  endDate: "2026-08-27",
  adults: 2,
  children: [3, 6],
  travelStyle: "balanced",
  walkingLimit: "medium",
  transportationType: "taxis",
  accommodationType: "staying_with_family_or_friends",
  stayAddress: "Sister’s house, Lakewood, Dallas, TX",
  stayPlaceId: "design-lab-dallas-stay",
  stayLat: STAY.lat,
  stayLng: STAY.lng,
  dietaryRestrictions: "",
  naps: [{ startTime: "12:30 PM", endTime: "2:00 PM", type: "regular" }],
  budgetStyle: "balanced",
  interests: [
    "Interactive Museums",
    "Indoor & Outdoor Play",
    "Shopping",
    "Swimming & Water Play",
  ],
};

const USD: Omit<DayCostBreakdown, "food" | "transport" | "activities" | "total"> = {
  currency: "USD",
  note: "Comfortable spend — mix of paid highlights and kitchen meals.",
};

function money(food: number, transport: number, activities: number): DayCostBreakdown {
  return {
    ...USD,
    food,
    transport,
    activities,
    total: food + transport + activities,
  };
}

function stop(
  time: string,
  endTime: string,
  title: string,
  type: ItineraryActivity["type"],
  extras: Partial<ItineraryActivity> = {},
): ItineraryActivity {
  const hour = Number(time.slice(0, 2));
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return { time, endTime, title, type, timeOfDay, ...extras };
}

function taxi(from: string, to: string, km: number, min: number, cost: number): RouteSegment {
  return { from, to, distanceKm: km, durationMin: min, bufferMin: 8, cost, provider: "Taxi" };
}

function travel(time: string, title: string, cost: number, location?: ActivityLocation): ItineraryActivity {
  return stop(time, time, title, "travel", { activityCost: cost, location });
}

function day(
  n: number,
  date: string,
  weekday: string,
  formattedDate: string,
  displayTitle: string,
  activities: ItineraryActivity[],
  breakdown: DayCostBreakdown,
  routeSegments: RouteSegment[],
): ItineraryDay {
  return {
    day: n,
    date,
    weekday,
    formattedDate,
    displayTitle,
    activities,
    costBreakdown: breakdown,
    costs: breakdown,
    accommodationTips: n === 1 ? ["Kitchen breakfasts and dinners keep the day anchored at home for the 12:30 nap."] : [],
    metrics: {
      transportCost: breakdown.transport,
      transportLabel: "Taxi",
      distanceKm: routeSegments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    },
    routeSegments,
    mapUrl: null,
  };
}

export const DALLAS_ITINERARY: Itinerary = {
  destination: "Dallas, TX, USA",
  destinationCity: "Dallas",
  tripStartFormatted: "August 24, 2026",
  currency: "USD",
  currencySymbol: "$",
  pricingDisclaimer: PRICING_DISCLAIMER,
  budgetStyle: "balanced",
  days: [
    day(
      1,
      "2026-08-24",
      "Monday",
      "Monday, August 24, 2026",
      "Museum morning, home for nap",
      [
        stop("08:00", "08:45", "Kitchen breakfast", "meal", {
          notes: "Eat at home so you can leave by 9 without hunting for a table.",
          location: STAY,
        }),
        travel("09:00", "Taxi to Perot Museum", 18, PEROT),
        stop("09:15", "12:00", "Perot Museum of Nature and Science", "activity", {
          location: PEROT,
          activityCost: 92,
          rating: 4.6,
          reviewCount: 18400,
          interestTags: ["museums"],
          notes: "Start at the dinosaurs, then the sports hall. Two hours is plenty with a 3-year-old.",
        }),
        travel("12:05", "Taxi home", 18, STAY),
        stop("12:30", "14:00", "Nap at sister’s house", "nap", {
          location: STAY,
          notes: "Regular nap in a quiet room — not a stroller nap.",
        }),
        stop("14:00", "14:40", "Kitchen lunch", "meal", {
          location: STAY,
          notes: "Simple lunch at home after the nap so the afternoon start isn’t rushed.",
        }),
        travel("14:50", "Taxi to We Rock the Spectrum", 16, WE_ROCK),
        stop("15:00", "16:45", "We Rock the Spectrum", "activity", {
          location: WE_ROCK,
          activityCost: 36,
          rating: 4.8,
          reviewCount: 620,
          interestTags: ["indoor-play"],
          notes: "Indoor play that works when Dallas is hot. Easy to leave when energy drops.",
        }),
        travel("16:50", "Taxi home", 16, STAY),
        stop("18:00", "19:00", "Kitchen dinner", "meal", {
          location: STAY,
          notes: "Back home for dinner — no restaurant with two tired kids after indoor play.",
        }),
      ],
      money(0, 68, 128),
      [
        taxi("Sister’s house, Lakewood", "Perot Museum of Nature and Science", 9.4, 18, 18),
        taxi("Perot Museum of Nature and Science", "Sister’s house, Lakewood", 9.4, 18, 18),
        taxi("Sister’s house, Lakewood", "We Rock the Spectrum", 12.1, 22, 16),
        taxi("We Rock the Spectrum", "Sister’s house, Lakewood", 12.1, 22, 16),
      ],
    ),
    day(
      2,
      "2026-08-25",
      "Tuesday",
      "Tuesday, August 25, 2026",
      "Water day, home between swims",
      [
        stop("08:00", "08:45", "Kitchen breakfast", "meal", { location: STAY }),
        travel("09:20", "Taxi to Heights Family Aquatic Center", 14, HEIGHTS),
        stop("09:30", "12:00", "Heights Family Aquatic Center", "activity", {
          location: HEIGHTS,
          activityCost: 48,
          rating: 4.4,
          reviewCount: 890,
          interestTags: ["beaches"],
          notes: "Go at open for shade and a shorter line. Pack snacks — the 3-year-old will be in the water, not at a café.",
        }),
        travel("12:10", "Taxi home", 14, STAY),
        stop("12:30", "14:00", "Nap at sister’s house", "nap", { location: STAY }),
        stop("14:00", "14:40", "Kitchen lunch", "meal", { location: STAY }),
        stop("15:00", "16:30", "Backyard quiet play", "rest", {
          location: STAY,
          notes: "A second swim is too much after a nap. Let them play at the house.",
        }),
        stop("18:00", "19:00", "Kitchen dinner", "meal", { location: STAY }),
      ],
      money(0, 28, 48),
      [
        taxi("Sister’s house, Lakewood", "Heights Family Aquatic Center", 8.2, 16, 14),
        taxi("Heights Family Aquatic Center", "Sister’s house, Lakewood", 8.2, 16, 14),
      ],
    ),
    day(
      3,
      "2026-08-26",
      "Wednesday",
      "Wednesday, August 26, 2026",
      "Mall morning, short hop, early night",
      [
        stop("08:00", "08:40", "Kitchen breakfast", "meal", { location: STAY }),
        travel("09:10", "Taxi to Grapevine Mills", 32, MILLS),
        stop("09:30", "12:00", "Grapevine Mills", "activity", {
          location: MILLS,
          activityCost: 0,
          rating: 4.3,
          reviewCount: 22100,
          interestTags: ["shopping"],
          notes: "Long taxi. Go once, do the play area and a couple of shops, then head home for nap — don’t add a second stop.",
        }),
        travel("12:10", "Taxi home", 32, STAY),
        stop("12:45", "14:15", "Nap at sister’s house", "nap", {
          location: STAY,
          notes: "Nap starts a little late after the Grapevine ride. Protect it anyway.",
        }),
        stop("14:20", "15:00", "Kitchen lunch", "meal", { location: STAY }),
        stop("15:30", "16:30", "Neighborhood walk", "rest", {
          location: STAY,
          notes: "Stay close to home. The morning already used the long taxi budget.",
        }),
        stop("18:00", "19:00", "Kitchen dinner", "meal", { location: STAY }),
      ],
      money(0, 64, 0),
      [
        taxi("Sister’s house, Lakewood", "Grapevine Mills", 28.4, 32, 32),
        taxi("Grapevine Mills", "Sister’s house, Lakewood", 28.4, 32, 32),
      ],
    ),
    day(
      4,
      "2026-08-27",
      "Thursday",
      "Thursday, August 27, 2026",
      "Adventure park, then home",
      [
        stop("08:00", "08:45", "Kitchen breakfast", "meal", { location: STAY }),
        travel("09:20", "Taxi to Takeoff Adventure Park", 22, TAKEOFF),
        stop("09:30", "12:00", "Takeoff Adventure Park", "activity", {
          location: TAKEOFF,
          activityCost: 64,
          rating: 4.7,
          reviewCount: 1540,
          interestTags: ["indoor-play"],
          notes: "Indoor trampoline and play for both ages. Leave before the nap window even if they beg for one more jump.",
        }),
        travel("12:10", "Taxi home", 22, STAY),
        stop("12:30", "14:00", "Nap at sister’s house", "nap", { location: STAY }),
        stop("14:00", "14:40", "Kitchen lunch", "meal", { location: STAY }),
        stop("15:30", "16:30", "Pack-up and quiet play", "rest", {
          location: STAY,
          notes: "Last afternoon at the house. No extra paid stop — the trip already has its highlights.",
        }),
        stop("18:00", "19:00", "Kitchen dinner", "meal", { location: STAY }),
      ],
      money(0, 44, 64),
      [
        taxi("Sister’s house, Lakewood", "Takeoff Adventure Park", 18.6, 24, 22),
        taxi("Takeoff Adventure Park", "Sister’s house, Lakewood", 18.6, 24, 22),
      ],
    ),
  ],
};

export const DALLAS_STAY = STAY;
export const DALLAS_PLACES = [PEROT, WE_ROCK, HEIGHTS, MILLS, TAKEOFF, STAY] as const;
