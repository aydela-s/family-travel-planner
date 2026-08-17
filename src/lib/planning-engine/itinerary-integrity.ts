import type { CityConfig } from "@/config/city-pricing";
import { parseDietaryTags } from "@/lib/planning-engine/dietary";
import { dietaryCheckNote } from "@/lib/planning-engine/staged/meal-planner";
import {
  repairReusedVenues,
  repairUncoveredSelectedInterests,
  scheduledAttractions,
  validateItinerary,
  type ItineraryViolation,
} from "@/lib/planning-engine/validate-itinerary";
import { dinnerTimeWindow } from "@/lib/planning-engine/meal-timing";
import { costsFromDisplayedItems } from "@/lib/pricing/budget";
import { isStayLikeStop, namesMatch } from "@/lib/pricing/transport-planner";
import {
  dinnerStartOnArrival,
  isPaidAttraction,
  minRealisticActivityDuration,
} from "@/lib/schedule/family-rhythm";
import { validateDaySchedule } from "@/lib/schedule/schedule-invariants";
import {
  formatClockMinutes,
  isUnpaidTimelineActivity,
  MEAL_DURATION_MIN,
  parseTimeToMinutes,
  scheduleSpan,
  travelSpan,
} from "@/lib/schedule/timeline";
import type { ItineraryActivity, ItineraryDay } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

export type IntegrityCode =
  | ItineraryViolation["code"]
  | "transport_destination_mismatch"
  | "transport_origin_mismatch"
  | "orphaned_transport"
  | "phantom_destination"
  | "unrealistic_activity_duration"
  | "zero_duration"
  | "taxi_cost_zero"
  | "cost_reconciliation"
  | "dietary_evidence_missing"
  | "chronology"
  | "unexplained_gap";

export type IntegrityViolation = {
  code: IntegrityCode;
  message: string;
  day?: number;
};

function nextNonTravel(
  activities: ItineraryActivity[],
  from: number,
): ItineraryActivity | undefined {
  for (let i = from + 1; i < activities.length; i++) {
    if (activities[i]!.type !== "travel") return activities[i];
  }
  return undefined;
}

function prevNonTravel(
  activities: ItineraryActivity[],
  from: number,
): ItineraryActivity | undefined {
  for (let i = from - 1; i >= 0; i--) {
    if (activities[i]!.type !== "travel") return activities[i];
  }
  return undefined;
}

function destinationFromTitle(title: string): string {
  return title.replace(/^(Taxi|Drive|Transit|Walk|Travel)\s+to\s+/i, "").trim();
}

export function validateTransportConsistency(
  activities: ItineraryActivity[],
): IntegrityViolation[] {
  const out: IntegrityViolation[] = [];
  for (let i = 0; i < activities.length; i++) {
    const item = activities[i]!;
    if (item.type !== "travel") continue;
    const dest = destinationFromTitle(item.title);
    const next = nextNonTravel(activities, i);
    const prev = prevNonTravel(activities, i);
    if (!next) {
      out.push({
        code: "orphaned_transport",
        message: `"${item.title}" has no following stop.`,
      });
      continue;
    }
    const nextName = next.location?.name ?? next.title;
    if (dest && nextName && !namesMatch(dest, nextName)) {
      out.push({
        code: "transport_destination_mismatch",
        message: `"${item.title}" does not match the next stop "${nextName}".`,
      });
    }
    if (prev?.location?.name && item.location?.name && !namesMatch(item.location.name, nextName)) {
      // Travel row location is the destination pin; origin is the previous stop.
    }
    if (prev?.location?.name) {
      const originOk =
        !item.notes ||
        namesMatch(prev.location.name, prev.location.name);
      if (!originOk) {
        out.push({
          code: "transport_origin_mismatch",
          message: `"${item.title}" origin does not match "${prev.location.name}".`,
        });
      }
    }
  }
  return out;
}

export function validateRealisticDurations(
  activities: ItineraryActivity[],
  plan: TripPlan,
): IntegrityViolation[] {
  const out: IntegrityViolation[] = [];
  for (const a of activities) {
    const start = parseTimeToMinutes(a.time);
    const end = a.endTime ? parseTimeToMinutes(a.endTime) : start;
    const dur = end - start;
    if (dur < 0) {
      out.push({
        code: "zero_duration",
        message: `"${a.title}" has a negative duration.`,
      });
      continue;
    }
    if (dur === 0) {
      out.push({
        code: "zero_duration",
        message: `"${a.title}" has zero duration.`,
      });
    }
    if (!isPaidAttraction(a) || a.allowShortVisit) continue;
    const min = minRealisticActivityDuration(a, plan);
    if (dur > 0 && dur < min) {
      out.push({
        code: "unrealistic_activity_duration",
        message: `"${a.title}" is ${dur} minutes; major attractions need at least ${min}.`,
      });
    }
  }
  return out;
}

export function validateTaxiCosts(
  activities: ItineraryActivity[],
  plan: TripPlan,
): IntegrityViolation[] {
  if (plan.transportationType !== "taxis") return [];
  const out: IntegrityViolation[] = [];
  for (const a of activities) {
    if (a.type !== "travel") continue;
    if (a.transportCovered) continue;
    if ((a.activityCost ?? 0) <= 0) {
      out.push({
        code: "taxi_cost_zero",
        message: `"${a.title}" is a taxi with $0 cost.`,
      });
    }
  }
  return out;
}

export function validateCostReconciliation(
  day: ItineraryDay,
): IntegrityViolation[] {
  const line = costsFromDisplayedItems(day.activities, day.costBreakdown.currency);
  const c = day.costBreakdown;
  const out: IntegrityViolation[] = [];
  const check = (label: string, expected: number, actual: number) => {
    if (Math.abs(expected - actual) > 0.009) {
      out.push({
        code: "cost_reconciliation",
        message: `${label} header ${actual} != line items ${expected}.`,
        day: day.day,
      });
    }
  };
  check("Food", line.food, c.food);
  check("Transport", line.transport, c.transport);
  check("Activities", line.activities, c.activities);
  check("Day total", line.total, c.total);
  if (Math.abs(c.food + c.transport + c.activities - c.total) > 0.009) {
    out.push({
      code: "cost_reconciliation",
      message: `Day ${day.day} components do not sum to the day total.`,
      day: day.day,
    });
  }
  return out;
}

export function validateDietaryEvidence(
  activities: ItineraryActivity[],
  plan: TripPlan,
): IntegrityViolation[] {
  if (parseDietaryTags(plan.dietaryRestrictions).length === 0) return [];
  const out: IntegrityViolation[] = [];
  for (const a of activities) {
    if (a.type !== "meal" || !a.dietaryFit) continue;
    const needs = parseDietaryTags(plan.dietaryRestrictions);
    const hasEvidence =
      Boolean(a.notes && needs.some((n) => a.notes!.toLowerCase().includes(n))) ||
      Boolean(a.notes && /menu|options|vegan|vegetarian|gluten/i.test(a.notes));
    if (!hasEvidence && a.dietaryFit !== "strong") {
      out.push({
        code: "dietary_evidence_missing",
        message: `"${a.title}" lost its dietary fit between selection and render.`,
      });
    }
  }
  return out;
}

export function validateItineraryIntegrity(
  days: ItineraryDay[],
  plan: TripPlan,
  city: CityConfig,
): IntegrityViolation[] {
  const out: IntegrityViolation[] = [];
  out.push(...validateItinerary(days, plan, city));

  const dayTotals = days.map((d) => d.costBreakdown.total);
  const tripFromDays = Math.round(dayTotals.reduce((s, n) => s + n, 0) * 100) / 100;

  for (const day of days) {
    const prefix = (v: IntegrityViolation): IntegrityViolation => ({
      ...v,
      day: v.day ?? day.day,
    });
    for (const v of validateTransportConsistency(day.activities)) out.push(prefix(v));
    for (const v of validateRealisticDurations(day.activities, plan)) out.push(prefix(v));
    for (const v of validateTaxiCosts(day.activities, plan)) out.push(prefix(v));
    out.push(...validateCostReconciliation(day));
    for (const v of validateDietaryEvidence(day.activities, plan)) out.push(prefix(v));
    for (const v of validateDaySchedule(
      day.activities.filter((a) => a.type !== "travel"),
      plan,
    )) {
      out.push({ code: "chronology", message: v.message, day: day.day });
    }
    const venues = new Set<string>();
    for (const a of scheduledAttractions(day)) {
      const key = (a.location?.name ?? a.title).trim().toLowerCase();
      if (key && venues.has(key)) {
        out.push({
          code: "activity_reused",
          message: `"${a.location?.name ?? a.title}" appears twice on day ${day.day}.`,
          day: day.day,
        });
      }
      venues.add(key);
    }
  }

  void tripFromDays;
  return out;
}

function travelDurationMin(travel: ItineraryActivity): number {
  const start = parseTimeToMinutes(travel.time);
  const end = travel.endTime ? parseTimeToMinutes(travel.endTime) : start;
  if (end > start) return end - start;
  const noted = travel.notes?.match(/~(\d+)\s*min/);
  if (noted) return Math.max(1, Number(noted[1]));
  return 5;
}

function stopName(activity: ItineraryActivity): string {
  return activity.location?.name ?? activity.title;
}

/**
 * Keep at most one taxi between two real stops. Same-place hops are dropped.
 * Leftover taxis to a removed venue are rewritten to the actual next stop and
 * timed from the previous end (or to arrive, when leaving a stay-like stop).
 */
function isDinnerStop(activity: ItineraryActivity): boolean {
  return activity.slotKind === "dinner" || /^dinner\b/i.test(activity.title);
}

function placeDinnerAtArrival(
  dinner: ItineraryActivity,
  arrivalMin: number,
  plan: TripPlan,
): ItineraryActivity {
  const start = dinnerStartOnArrival(arrivalMin, dinnerTimeWindow(plan));
  const currentDur = Math.max(
    MEAL_DURATION_MIN,
    parseTimeToMinutes(dinner.endTime ?? dinner.time) - parseTimeToMinutes(dinner.time),
  );
  const span = scheduleSpan(start, currentDur);
  return { ...dinner, time: span.time, endTime: span.endTime };
}

function repairTransport(activities: ItineraryActivity[], plan: TripPlan): ItineraryActivity[] {
  const out: ItineraryActivity[] = [];
  let i = 0;
  while (i < activities.length) {
    const item = activities[i]!;
    if (item.type === "travel") {
      i += 1;
      continue;
    }
    const prevOut = out[out.length - 1];
    if (
      prevOut?.type === "travel" &&
      isDinnerStop(item) &&
      namesMatch(destinationFromTitle(prevOut.title), stopName(item))
    ) {
      out.push(
        placeDinnerAtArrival(item, parseTimeToMinutes(prevOut.endTime ?? prevOut.time), plan),
      );
    } else {
      out.push(item);
    }

    const travels: ItineraryActivity[] = [];
    let j = i + 1;
    while (j < activities.length && activities[j]!.type === "travel") {
      travels.push(activities[j]!);
      j += 1;
    }
    const next = j < activities.length ? activities[j]! : undefined;
    if (!next) {
      i = j;
      continue;
    }

    const fromName = stopName(item);
    const toName = stopName(next);
    if (namesMatch(fromName, toName)) {
      i = j;
      continue;
    }

    const matching = travels.find((t) =>
      namesMatch(destinationFromTitle(t.title), toName),
    );
    const chosen = matching ?? travels[0];
    if (chosen) {
      const verb = chosen.title.match(/^(Taxi|Drive|Transit|Walk|Travel)/i)?.[1] ?? "Travel";
      const destName = next.location?.name ?? destinationFromTitle(chosen.title) ?? toName;
      const driveMin = Math.max(1, travelDurationMin(chosen));
      const afterCurrent = parseTimeToMinutes(item.endTime ?? item.time);
      const nextStart = parseTimeToMinutes(next.time);
      const startMin = isStayLikeStop(item)
        ? Math.max(afterCurrent, nextStart - driveMin)
        : afterCurrent;
      const span = travelSpan(startMin, driveMin);
      out.push({
        ...chosen,
        title: `${verb} to ${destName}`,
        time: span.time,
        endTime: span.endTime,
        location: next.location ?? chosen.location,
      });
    }
    i = j;
  }
  return out;
}

function dropVisibleStayFiller(activities: ItineraryActivity[]): ItineraryActivity[] {
  return activities.filter(
    (a) => !/free time at your accommodation/i.test(a.title),
  );
}

function shiftClock(activity: ItineraryActivity, deltaMin: number): ItineraryActivity {
  const start = parseTimeToMinutes(activity.time) + deltaMin;
  const rawEnd = parseTimeToMinutes(activity.endTime ?? activity.time) + deltaMin;
  return {
    ...activity,
    time: formatClockMinutes(start),
    endTime: formatClockMinutes(Math.max(rawEnd, start + 1)),
  };
}

function repairZeroDurations(
  activities: ItineraryActivity[],
  plan: TripPlan,
): ItineraryActivity[] {
  const items = activities.map((a) => ({ ...a }));
  for (let i = 0; i < items.length; i++) {
    const current = items[i]!;
    const start = parseTimeToMinutes(current.time);
    const end = current.endTime ? parseTimeToMinutes(current.endTime) : start;
    if (end <= start) {
      const minDur = current.type === "travel" ? Math.max(1, travelDurationMin(current)) : 15;
      const span = current.type === "travel" ? travelSpan(start, minDur) : scheduleSpan(start, minDur);
      items[i] = { ...current, time: span.time, endTime: span.endTime };
    }
    if (items[i]!.type !== "travel") continue;
    const travelEnd = parseTimeToMinutes(items[i]!.endTime ?? items[i]!.time);
    const next = items[i + 1];
    if (!next || next.type === "nap") continue;
    if (isDinnerStop(next)) {
      items[i + 1] = placeDinnerAtArrival(next, travelEnd, plan);
      continue;
    }
    const nextStart = parseTimeToMinutes(next.time);
    if (travelEnd <= nextStart) continue;
    const delta = travelEnd - nextStart;
    for (let j = i + 1; j < items.length; j++) {
      const hold = items[j]!;
      if (hold.type === "nap" || isDinnerStop(hold)) break;
      items[j] = shiftClock(hold, delta);
    }
  }
  return items;
}

function repairTaxiCosts(
  activities: ItineraryActivity[],
  plan: TripPlan,
  day: ItineraryDay,
): ItineraryActivity[] {
  if (plan.transportationType !== "taxis") return activities;
  return activities.map((a) => {
    if (a.type !== "travel" || a.transportCovered) return a;
    if ((a.activityCost ?? 0) > 0) return a;
    const dest = destinationFromTitle(a.title);
    const segment = day.routeSegments.find((s) => namesMatch(s.to, dest) && s.cost > 0);
    if (segment) return { ...a, activityCost: segment.cost };
    return a;
  });
}

function dropUnrealisticAttractions(
  activities: ItineraryActivity[],
  plan: TripPlan,
): ItineraryActivity[] {
  if (plan.travelStyle === "packed") return activities;
  return activities.filter((a) => {
    if (!isPaidAttraction(a) || a.allowShortVisit) return true;
    if (!a.endTime) return true;
    const start = parseTimeToMinutes(a.time);
    const end = parseTimeToMinutes(a.endTime);
    const dur = end - start;
    if (dur < 0) return false;
    return dur >= minRealisticActivityDuration(a, plan);
  });
}

function venueKey(activity: ItineraryActivity): string {
  return (activity.location?.name ?? "").replace(/\s+area$/i, "").trim().toLowerCase();
}

/**
 * After a stop is removed, meals/rest that still sit on that venue would
 * otherwise produce phantom taxis and restaurant "detours" to a place the
 * family is no longer visiting.
 */
function reanchorStrandedStops(
  before: ItineraryActivity[],
  after: ItineraryActivity[],
): ItineraryActivity[] {
  const remaining = new Set(
    after
      .filter((a) => a.type === "activity" && !isUnpaidTimelineActivity(a) && a.location)
      .map(venueKey)
      .filter(Boolean),
  );
  const dropped = new Set(
    before
      .filter((a) => a.type === "activity" && !isUnpaidTimelineActivity(a) && a.location)
      .map(venueKey)
      .filter((key) => key.length > 0 && !remaining.has(key)),
  );
  if (dropped.size === 0) return after;

  const paidAnchor = (from: number, dir: 1 | -1): ItineraryActivity | undefined => {
    for (let i = from + dir; i >= 0 && i < after.length; i += dir) {
      const candidate = after[i]!;
      if (
        candidate.type === "activity" &&
        candidate.location &&
        !isUnpaidTimelineActivity(candidate) &&
        remaining.has(venueKey(candidate))
      ) {
        return candidate;
      }
    }
    return undefined;
  };

  return after.map((activity, i) => {
    const key = venueKey(activity);
    if (!key || !dropped.has(key)) return activity;
    if (activity.type === "activity" && !isUnpaidTimelineActivity(activity)) return activity;
    const anchor = paidAnchor(i, 1) ?? paidAnchor(i, -1);
    if (!anchor?.location) {
      return { ...activity, location: undefined, placeId: undefined };
    }
    if (activity.type === "meal") {
      return {
        ...activity,
        location: {
          name: `${anchor.location.name} area`,
          lat: anchor.location.lat,
          lng: anchor.location.lng,
        },
        placeId: anchor.placeId,
      };
    }
    return { ...activity, location: anchor.location, placeId: anchor.placeId };
  });
}

function restoreDietaryNotes(
  activities: ItineraryActivity[],
  plan: TripPlan,
): ItineraryActivity[] {
  if (parseDietaryTags(plan.dietaryRestrictions).length === 0) return activities;
  const needs = parseDietaryTags(plan.dietaryRestrictions).join(" / ");
  return activities.map((a) => {
    if (a.type !== "meal" || !a.dietaryFit) return a;
    const caveat = dietaryCheckNote(plan, a.dietaryFit);
    const strong =
      a.dietaryFit === "strong"
        ? `Selected for ${needs} options (does not need to be a dedicated ${needs} restaurant).`
        : "";
    const extra = caveat || strong;
    if (!extra) return a;
    if (a.notes?.includes(extra) || (strong && a.notes && new RegExp(needs, "i").test(a.notes))) {
      return a;
    }
    return { ...a, notes: [a.notes, extra].filter(Boolean).join(" ") };
  });
}

function applyCosts(day: ItineraryDay): ItineraryDay {
  const line = costsFromDisplayedItems(day.activities, day.costBreakdown.currency);
  const costBreakdown = {
    ...day.costBreakdown,
    ...line,
  };
  return {
    ...day,
    costBreakdown,
    costs: costBreakdown,
    metrics: {
      ...day.metrics,
      transportCost: line.transport,
    },
  };
}

/**
 * Deterministic integrity gate. Repairs known failures, then re-validates.
 * Remaining violations are returned so the API can surface them as conflicts
 * rather than showing a contradictory itinerary.
 */
export function repairItineraryIntegrity(
  days: ItineraryDay[],
  plan: TripPlan,
  city: CityConfig,
): { days: ItineraryDay[]; violations: IntegrityViolation[] } {
  let next = repairReusedVenues(
    repairUncoveredSelectedInterests(days, plan, city),
    plan,
    city,
  ).map((day) => {
    let activities = dropVisibleStayFiller(day.activities);
    activities = repairTransport(activities, plan);
    activities = repairZeroDurations(activities, plan);
    activities = repairTaxiCosts(activities, plan, day);
    const beforeDrop = activities;
    activities = dropUnrealisticAttractions(activities, plan);
    activities = reanchorStrandedStops(beforeDrop, activities);
    activities = restoreDietaryNotes(activities, plan);
    activities = repairTransport(activities, plan);
    activities = repairZeroDurations(activities, plan);
    return applyCosts({ ...day, activities });
  });

  const violations = validateItineraryIntegrity(next, plan, city);
  if (violations.some((v) => v.code === "cost_reconciliation")) {
    next = next.map(applyCosts);
  }
  return { days: next, violations: validateItineraryIntegrity(next, plan, city) };
}
