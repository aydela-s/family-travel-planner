import type { Landmark } from "@/config/city-pricing";
import { pureTravelMin } from "@/lib/maps/travel-estimate";
import {
  compileTripConstraints,
  excludedInterestTags,
  excludedVenueNames,
  matchesExcludedVenue,
  maxDriveMin,
  type HardConstraint,
  type HardRuleKind,
  type TripConstraints,
} from "@/lib/planning-engine/constraints";
import { isKnownClosedForVisit, type VisitWindow } from "@/lib/schedule/landmark-hours";
import type { TripPlan } from "@/types/trip-plan";

/** Why a stop is not usable. Every reason here is a hard rule, never a score. */
export type StopRejection = {
  rule: HardRuleKind;
  /** Set when the rule came from an explicit user constraint. */
  constraint?: HardConstraint;
  reason: string;
};

export type StopEligibilityContext = {
  plan: TripPlan;
  /** Compiled once by the caller when it filters many candidates. */
  constraints?: TripConstraints;
  /** Planned arrival window — required for the closed-venue rule to apply. */
  visitWindow?: VisitWindow;
};

/** True when the family has a child outside the venue's enforced age range. */
export function violatesAgeRestriction(
  venue: { minAge?: number; maxAge?: number },
  plan: Pick<TripPlan, "children">,
): boolean {
  if (venue.minAge == null && venue.maxAge == null) return false;
  return plan.children.some(
    (age) =>
      (venue.minAge != null && age < venue.minAge) ||
      (venue.maxAge != null && age > venue.maxAge),
  );
}

function driveMinFromStay(landmark: Landmark, plan: TripPlan): number | null {
  if (typeof plan.stayLat !== "number" || typeof plan.stayLng !== "number") return null;
  return pureTravelMin({ lat: plan.stayLat, lng: plan.stayLng }, landmark, plan);
}

/**
 * The single hard gate for activity stops. Everything else about picking a stop
 * stays score-based; nothing here can be outscored.
 */
export function stopRejection(
  landmark: Landmark,
  ctx: StopEligibilityContext,
): StopRejection | null {
  const constraints = ctx.constraints ?? compileTripConstraints(ctx.plan);

  const excludedNames = excludedVenueNames(constraints);
  if (matchesExcludedVenue(landmark.name, excludedNames)) {
    return {
      rule: "exclude_venue",
      constraint: { kind: "exclude_venue", name: landmark.name },
      reason: `"${landmark.name}" is on the excluded list`,
    };
  }

  const excludedTags = excludedInterestTags(constraints);
  const blockedTag = landmark.interestTags.find((t) => excludedTags.has(t));
  if (blockedTag) {
    return {
      rule: "exclude_interest",
      constraint: { kind: "exclude_interest", tag: blockedTag },
      reason: `"${landmark.name}" is a ${blockedTag} stop, which the family excluded`,
    };
  }

  if (violatesAgeRestriction(landmark, ctx.plan)) {
    const range =
      landmark.minAge != null && landmark.maxAge != null
        ? `ages ${landmark.minAge}–${landmark.maxAge}`
        : landmark.minAge != null
          ? `minimum age ${landmark.minAge}`
          : `maximum age ${landmark.maxAge}`;
    return {
      rule: "age_restriction",
      reason: `"${landmark.name}" enforces ${range}`,
    };
  }

  if (ctx.visitWindow && isKnownClosedForVisit(landmark, ctx.visitWindow)) {
    return {
      rule: "venue_closed",
      reason: `"${landmark.name}" is closed at the planned visit time`,
    };
  }

  const driveLimit = maxDriveMin(constraints);
  if (driveLimit != null) {
    const driveMin = driveMinFromStay(landmark, ctx.plan);
    if (driveMin != null && driveMin > driveLimit) {
      return {
        rule: "max_drive_min",
        constraint: { kind: "max_drive_min", minutes: driveLimit },
        reason: `"${landmark.name}" is ~${driveMin} min from the stay, over the ${driveLimit} min limit`,
      };
    }
  }

  return null;
}

export function isEligibleStop(landmark: Landmark, ctx: StopEligibilityContext): boolean {
  return stopRejection(landmark, ctx) === null;
}

export type StopEligibilitySplit = {
  eligible: Landmark[];
  rejected: Array<{ landmark: Landmark; rejection: StopRejection }>;
};

/** Split a candidate list, keeping the rejections so conflicts can name them. */
export function splitEligibleStops(
  landmarks: Landmark[],
  ctx: StopEligibilityContext,
): StopEligibilitySplit {
  const eligible: Landmark[] = [];
  const rejected: StopEligibilitySplit["rejected"] = [];
  for (const landmark of landmarks) {
    const rejection = stopRejection(landmark, ctx);
    if (rejection) rejected.push({ landmark, rejection });
    else eligible.push(landmark);
  }
  return { eligible, rejected };
}
