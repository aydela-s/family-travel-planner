import { CityConfig } from "@/config/city-pricing";
import { formatMiles } from "@/lib/format-distance";
import { minutesToTime, parseTimeToMinutes } from "@/lib/schedule/timeline";
import { TripPlan } from "@/types/trip-plan";
import type { ItineraryActivity, RouteSegment } from "@/types/itinerary";

/**
 * Driving cost is exactly two things, and both are always shown separately:
 *
 *   fuel    = distance_km / 100 × FUEL_CONSUMPTION_L_PER_100KM × city fuel price
 *   parking = city parking fee × number of stops you park at
 *
 * Nothing else is folded in — no rental day rate, tolls, insurance, or wear.
 * 9 L/100km (~26 mpg) is a typical family rental (mid-size car / small SUV).
 */
export const FUEL_CONSUMPTION_L_PER_100KM = 9;

function roundMoney(amount: number, currency: string): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

export function familyTransitRiders(plan: TripPlan): number {
  return plan.adults + plan.children.length;
}

/** Fuel burned over a driven distance, at the city's pump price. */
export function estimateFuelCostForDriving(city: CityConfig, totalKm: number): number {
  if (totalKm <= 0) return 0;
  const liters = (totalKm / 100) * FUEL_CONSUMPTION_L_PER_100KM;
  return roundMoney(city.transport.fuelPricePerLiter * liters, city.currency);
}

/**
 * Car rental rule: paid parking at each stop on the day's route.
 * `stopCount` is typically the number of route legs (each arrival parks).
 */
export function estimateParkingCost(city: CityConfig, stopCount: number): number {
  const stops = Math.max(0, Math.floor(stopCount));
  if (stops <= 0) return 0;
  return roundMoney(city.transport.parkingFeePerStop * stops, city.currency);
}

export type DrivingLegCost = {
  fuel: number;
  parking: number;
  total: number;
};

/** Per-leg driving cost, split so the timeline can show the arithmetic. */
export function estimateDrivingLegCost(
  city: CityConfig,
  distanceKm: number,
  opts: { parkAtDestination: boolean } = { parkAtDestination: true },
): DrivingLegCost {
  if (distanceKm <= 0) return { fuel: 0, parking: 0, total: 0 };
  const fuel = estimateFuelCostForDriving(city, distanceKm);
  const parking = opts.parkAtDestination
    ? estimateParkingCost(city, 1)
    : 0;
  return { fuel, parking, total: roundMoney(fuel + parking, city.currency) };
}

export type PublicTransitChoice = {
  cost: number;
  label: string;
  method: "day-pass" | "individual";
};

/**
 * Public transit rule: pick the cheaper of a day pass vs individual
 * tickets for the whole family, based on how many rides the day needs.
 */
export function choosePublicTransitFare(
  city: CityConfig,
  plan: TripPlan,
  rideCount: number,
): PublicTransitChoice {
  const riders = familyTransitRiders(plan);
  const rides = Math.max(1, rideCount);
  const dayPassTotal = city.transport.publicTransitDayPass * riders;
  const individualTotal = city.transport.publicTransitSingleRide * riders * rides;

  if (dayPassTotal <= individualTotal) {
    return {
      cost: dayPassTotal,
      label: `Public transit day pass × ${riders}`,
      method: "day-pass",
    };
  }
  return {
    cost: individualTotal,
    label: `Public transit (${rides} rides × ${riders})`,
    method: "individual",
  };
}

/** Taxi rule: sum per-segment ride estimates for the day. */
export function estimateTaxiDailyCost(segmentCosts: number[]): number {
  return Math.round(segmentCosts.reduce((sum, cost) => sum + cost, 0) * 100) / 100;
}

const STAY_STOP = /\b(your stay|rental|airbnb|hotel|home)\b/i;

function isStayStop(name: string, plan: TripPlan): boolean {
  const stay = (plan.stayAddress ?? "").trim().toLowerCase();
  const stop = name.trim().toLowerCase();
  if (stay && (stop === stay || stop.includes(stay))) return true;
  return STAY_STOP.test(stop);
}

/**
 * Spread the day's transport model onto each route leg so the timeline can
 * show per-hop costs (fuel+parking, transit tickets, taxi fares).
 */
export function allocateRouteSegmentCosts(
  segments: RouteSegment[],
  plan: TripPlan,
  city: CityConfig,
): RouteSegment[] {
  const type = plan.transportationType;
  if (!type || type === "walking") {
    return segments.map((s) => ({ ...s, cost: 0 }));
  }

  if (type === "taxis") {
    // getDirections already priced each leg.
    return segments;
  }

  if (type === "car-rental") {
    return segments.map((s) => {
      if (s.distanceKm <= 0) return { ...s, cost: 0, fuelCost: 0, parkingCost: 0 };
      // You don't pay to park at your own stay.
      const leg = estimateDrivingLegCost(city, s.distanceKm, {
        parkAtDestination: !isStayStop(s.to, plan),
      });
      return {
        ...s,
        cost: leg.total,
        fuelCost: leg.fuel,
        parkingCost: leg.parking,
        provider: s.provider ?? "Car",
      };
    });
  }

  if (type === "public-transportation") {
    const billable = segments.filter((s) => s.distanceKm > 0);
    const choice = choosePublicTransitFare(city, plan, Math.max(1, billable.length));
    if (choice.method === "day-pass") {
      let assigned = false;
      return segments.map((s) => {
        if (s.distanceKm <= 0) return { ...s, cost: 0 };
        if (!assigned) {
          assigned = true;
          return { ...s, cost: choice.cost, provider: "Day pass" };
        }
        return { ...s, cost: 0, provider: "Day pass" };
      });
    }
    const perRide = billable.length > 0 ? choice.cost / billable.length : 0;
    return segments.map((s) =>
      s.distanceKm > 0
        ? {
            ...s,
            cost: roundMoney(perRide, city.currency),
            provider: s.provider ?? "Transit",
          }
        : { ...s, cost: 0 },
    );
  }

  return segments;
}

function travelVerb(plan: TripPlan, _segment: RouteSegment): string {
  switch (plan.transportationType) {
    case "car-rental":
      return "Drive";
    case "taxis":
      return "Taxi";
    case "public-transportation":
      return "Transit";
    case "walking":
      return "Walk";
    default:
      return "Travel";
  }
}

/** Label for the reported travel time — never the scheduled block. */
function travelTimeLabel(plan: TripPlan): string {
  switch (plan.transportationType) {
    case "car-rental":
    case "taxis":
      return "driving";
    case "public-transportation":
      return "on transit";
    case "walking":
      return "walking";
    default:
      return "travel";
  }
}

/**
 * Insert priced travel rows between consecutive located stops so each route
 * cost is visible on the timeline. Notes stay short: distance + travel time
 * only — buffer and fare live on the cost badge / schedule, not the copy.
 *
 * When route segments bookend the day with the stay (stay → first, last → stay),
 * those legs are inserted even though the stay is not a timeline activity.
 */
export function injectTravelActivities(
  activities: ItineraryActivity[],
  segments: RouteSegment[],
  plan: TripPlan,
  _currencySymbol: string = "$",
): ItineraryActivity[] {
  if (segments.length === 0) return activities;

  const result: ItineraryActivity[] = [];
  let segIdx = 0;

  const firstLocated = activities.find((a) => a.location);
  const firstSeg = segments[0];
  if (
    firstLocated &&
    firstSeg &&
    firstSeg.to &&
    firstLocated.location &&
    namesMatch(firstSeg.to, firstLocated.location.name) &&
    !namesMatch(firstSeg.from, firstLocated.location.name) &&
    (firstSeg.distanceKm > 0 || firstSeg.cost > 0)
  ) {
    const inboundMin = firstSeg.durationMin + (firstSeg.bufferMin ?? 0);
    result.push(
      travelActivity(
        firstSeg,
        plan,
        travelStartForArrival(firstLocated.time, inboundMin),
        firstLocated,
      ),
    );
    segIdx = 1;
  }

  for (let i = 0; i < activities.length; i++) {
    const current = activities[i]!;
    result.push(current);
    if (!current.location) continue;

    let nextIdx = i + 1;
    while (nextIdx < activities.length && !activities[nextIdx]!.location) nextIdx += 1;
    if (nextIdx >= activities.length) break;

    const segment = segments[segIdx++];
    if (!segment) break;
    if (segment.distanceKm <= 0 && segment.cost <= 0) continue;

    const next = activities[nextIdx]!;
    const inboundMin = segment.durationMin + (segment.bufferMin ?? 0);
    const travelStart = travelStartForArrival(next.time, inboundMin);
    const afterCurrent = parseTimeToMinutes(current.endTime ?? current.time);
    const startMin = Math.max(afterCurrent, parseTimeToMinutes(travelStart));
    result.push(travelActivity(segment, plan, minutesToTime(startMin), next));
  }

  const lastLocated = [...activities].reverse().find((a) => a.location);
  const remaining = segments.slice(segIdx);
  const homeLeg = remaining.find(
    (s) =>
      lastLocated?.location &&
      namesMatch(s.from, lastLocated.location.name) &&
      !namesMatch(s.to, lastLocated.location.name) &&
      (s.distanceKm > 0 || s.cost > 0),
  );
  if (homeLeg && lastLocated) {
    const end = lastLocated.endTime ?? lastLocated.time;
    result.push({
      time: end,
      endTime: end,
      title: `${travelVerb(plan, homeLeg)} to ${homeLeg.to}`,
      type: "travel",
      timeOfDay: "evening",
      notes: travelNotes(homeLeg, plan),
      activityCost: homeLeg.cost,
      location: {
        name: homeLeg.to,
        lat: lastLocated.location!.lat,
        lng: lastLocated.location!.lng,
      },
    });
  }

  return result;
}

export function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(area|café|cafe|near)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function travelNotes(segment: RouteSegment, plan: TripPlan): string {
  return [
    formatMiles(segment.distanceKm),
    `~${segment.durationMin} min ${travelTimeLabel(plan)}`,
  ].join(" · ");
}

function travelStartForArrival(arrivalTime: string, durationMin: number): string {
  const arrival = parseTimeToMinutes(arrivalTime);
  const start = Math.max(6 * 60, arrival - Math.max(1, durationMin));
  return minutesToTime(start);
}

function travelActivity(
  segment: RouteSegment,
  plan: TripPlan,
  startTime: string,
  next: ItineraryActivity,
): ItineraryActivity {
  return {
    time: startTime,
    endTime: next.time,
    title: `${travelVerb(plan, segment)} to ${segment.to}`,
    type: "travel",
    timeOfDay: next.timeOfDay,
    notes: travelNotes(segment, plan),
    activityCost: segment.cost,
    location: next.location,
  };
}
