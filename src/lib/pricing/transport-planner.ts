import { CityConfig } from "@/config/city-pricing";
import { formatMiles } from "@/lib/format-distance";
import { dinnerTimeWindow } from "@/lib/planning-engine/meal-timing";
import { dinnerStartOnArrival } from "@/lib/schedule/family-rhythm";
import {
  formatClockMinutes,
  MEAL_DURATION_MIN,
  minutesToTime,
  parseTimeToMinutes,
  scheduleSpan,
  travelSpan,
} from "@/lib/schedule/timeline";
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
export function isStayLikeStop(activity: ItineraryActivity): boolean {
  if (activity.type === "nap" || activity.type === "rest") return true;
  return /\b(takeout or delivery lunch at your stay|cook dinner at your rental|hotel breakfast|packed breakfast)\b/i.test(
    activity.title,
  );
}

function isDinnerStop(activity: ItineraryActivity): boolean {
  return activity.slotKind === "dinner" || /^dinner\b/i.test(activity.title);
}

function placeDinnerAtArrival(dinner: ItineraryActivity, arrivalMin: number, plan: TripPlan): ItineraryActivity {
  const start = dinnerStartOnArrival(arrivalMin, dinnerTimeWindow(plan));
  const currentDur = Math.max(
    MEAL_DURATION_MIN,
    parseTimeToMinutes(dinner.endTime ?? dinner.time) - parseTimeToMinutes(dinner.time),
  );
  const span = scheduleSpan(start, currentDur);
  return { ...dinner, time: span.time, endTime: span.endTime };
}

function shouldHoldClock(activity: ItineraryActivity): boolean {
  return (
    activity.type === "nap" ||
    activity.slotKind === "dinner" ||
    /^dinner\b/i.test(activity.title)
  );
}

function shiftActivityClock(activity: ItineraryActivity, deltaMin: number): ItineraryActivity {
  const start = parseTimeToMinutes(activity.time) + deltaMin;
  const rawEnd = parseTimeToMinutes(activity.endTime ?? activity.time) + deltaMin;
  return {
    ...activity,
    time: formatClockMinutes(start),
    endTime: formatClockMinutes(Math.max(rawEnd, start + 1)),
  };
}

function findHop(
  segments: RouteSegment[],
  fromName: string,
  toName: string,
): RouteSegment | undefined {
  return segments.find(
    (s) =>
      namesMatch(s.from, fromName) &&
      namesMatch(s.to, toName) &&
      (s.distanceKm > 0 || s.cost > 0),
  );
}

/**
 * Insert travel between located stops by matching the actual previous→next
 * venues — never by leftover segment index. A taxi never has zero duration:
 * it starts when the family leaves, lasts the driving time, and if that
 * overlaps the next stop the next stop moves later.
 */
export function injectTravelActivities(
  activities: ItineraryActivity[],
  segments: RouteSegment[],
  plan: TripPlan,
  _currencySymbol: string = "$",
): ItineraryActivity[] {
  if (segments.length === 0) return activities;

  const items = activities.map((a) => ({ ...a }));
  const result: ItineraryActivity[] = [];

  const firstLocated = items.find((a) => a.location);
  const inbound = firstLocated?.location
    ? segments.find(
        (s) =>
          namesMatch(s.to, firstLocated.location!.name) &&
          !namesMatch(s.from, firstLocated.location!.name) &&
          (s.distanceKm > 0 || s.cost > 0),
      )
    : undefined;
  if (inbound && firstLocated) {
    const inboundMin = Math.max(1, inbound.durationMin + (inbound.bufferMin ?? 0));
    const start = travelStartForArrival(firstLocated.time, inboundMin);
    const span = travelSpan(parseTimeToMinutes(start), inboundMin);
    result.push(travelActivity(inbound, plan, span.time, span.endTime, firstLocated));
  }

  for (let i = 0; i < items.length; i++) {
    const current = items[i]!;
    result.push(current);
    if (!current.location) continue;

    let nextIdx = i + 1;
    while (nextIdx < items.length && !items[nextIdx]!.location) nextIdx += 1;
    if (nextIdx >= items.length) break;

    const next = items[nextIdx]!;
    if (namesMatch(current.location.name, next.location!.name)) continue;

    const segment = findHop(segments, current.location.name, next.location!.name);
    if (!segment) continue;

    const driveMin = Math.max(1, segment.durationMin);
    const afterCurrent = parseTimeToMinutes(current.endTime ?? current.time);
    const nextStart = parseTimeToMinutes(next.time);
    const startMin = isStayLikeStop(current)
      ? Math.max(afterCurrent, nextStart - driveMin)
      : afterCurrent;
    const span = travelSpan(startMin, driveMin);
    const travelEnd = parseTimeToMinutes(span.endTime);
    if (isDinnerStop(next) && !isStayLikeStop(current)) {
      items[nextIdx] = placeDinnerAtArrival(items[nextIdx]!, travelEnd, plan);
    } else if (travelEnd > nextStart && !shouldHoldClock(next)) {
      const delta = travelEnd - nextStart;
      for (let j = nextIdx; j < items.length; j++) {
        if (shouldHoldClock(items[j]!)) break;
        items[j] = shiftActivityClock(items[j]!, delta);
      }
    }
    const dest = items[nextIdx]!;
    result.push(travelActivity(segment, plan, span.time, span.endTime, dest));
  }

  const lastLocated = [...items].reverse().find((a) => a.location);
  const homeLeg = lastLocated?.location
    ? segments.find(
        (s) =>
          namesMatch(s.from, lastLocated.location!.name) &&
          !namesMatch(s.to, lastLocated.location!.name) &&
          (s.distanceKm > 0 || s.cost > 0),
      )
    : undefined;
  if (homeLeg && lastLocated?.location && !namesMatch(lastLocated.location.name, homeLeg.to)) {
    const startMin = parseTimeToMinutes(lastLocated.endTime ?? lastLocated.time);
    const driveMin = Math.max(1, homeLeg.durationMin);
    const span = travelSpan(startMin, driveMin);
    result.push(
      travelActivity(homeLeg, plan, span.time, span.endTime, {
        ...lastLocated,
        timeOfDay: "evening",
        location: {
          name: homeLeg.to,
          lat: lastLocated.location!.lat,
          lng: lastLocated.location!.lng,
        },
      }),
    );
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
  endTime: string,
  next: ItineraryActivity,
): ItineraryActivity {
  const startMin = parseTimeToMinutes(startTime);
  const requestedEnd = parseTimeToMinutes(endTime);
  const span = travelSpan(startMin, Math.max(1, requestedEnd - startMin));
  return {
    time: span.time,
    endTime: span.endTime,
    title: `${travelVerb(plan, segment)} to ${segment.to}`,
    type: "travel",
    timeOfDay: next.timeOfDay,
    notes: travelNotes(segment, plan),
    activityCost: segment.cost,
    location: next.location,
  };
}
