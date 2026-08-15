import { getTripDayCount } from "@/lib/itinerary";
import { resolvePlannerEngine } from "@/lib/planning-engine/staged/engine-flag";
import type { WizardStepId } from "@/lib/plan-wizard/step-gate";
import type { TripPlan } from "@/types/trip-plan";

export const ANALYTICS_EVENTS = {
  plannerStarted: "planner_started",
  plannerStepViewed: "planner_step_viewed",
  plannerCompleted: "planner_completed",
  itineraryGenerated: "itinerary_generated",
  itineraryViewed: "itinerary_viewed",
  itineraryDownloaded: "itinerary_downloaded",
  itineraryShared: "itinerary_shared",
  /** Derived: first successful download or share for an itinerary in this tab session. */
  itineraryEngaged: "itinerary_engaged",
  feedbackSubmitted: "feedback_submitted",
} as const;

const ENGAGED_SESSION_PREFIX = "analytics:itinerary_engaged:";
/** Survives component remounts; sessionStorage also covers full tab reloads. */
const engagedInMemory = new Set<string>();

/** Stable key for deduping `itinerary_engaged` within a browser tab session. */
export function itineraryEngagementKey(input: {
  destination: string;
  startDate?: string;
  endDate?: string;
  tripStartFormatted?: string;
}): string {
  return [
    input.destination.trim().toLowerCase(),
    input.startDate ?? input.tripStartFormatted ?? "",
    input.endDate ?? "",
  ].join("|");
}

function hasEngagedThisSession(engagementKey: string): boolean {
  if (engagedInMemory.has(engagementKey)) return true;
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(`${ENGAGED_SESSION_PREFIX}${engagementKey}`) === "1";
  } catch {
    return false;
  }
}

function markEngagedThisSession(engagementKey: string): void {
  engagedInMemory.add(engagementKey);
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${ENGAGED_SESSION_PREFIX}${engagementKey}`, "1");
  } catch {
    /* private mode / quota — in-memory mark still applies for this page load */
  }
}

/** Clears engagement dedupe state (tests only). */
export function resetItineraryEngagementTracking(): void {
  engagedInMemory.clear();
  if (typeof sessionStorage === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(ENGAGED_SESSION_PREFIX)) toRemove.push(key);
    }
    for (const key of toRemove) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Fires `itinerary_engaged` at most once per itinerary key per tab session.
 * Call after a successful download or share; keep those as separate events too.
 */
export function trackItineraryEngaged(engagementKey: string): void {
  if (!engagementKey || hasEngagedThisSession(engagementKey)) return;
  markEngagedThisSession(engagementKey);
  capture(ANALYTICS_EVENTS.itineraryEngaged);
}

export type PlannerStepViewedProps = {
  step: WizardStepId;
  step_index: number;
};

export type ItineraryProductProps = {
  destination: string;
  trip_length_days: number;
  adults: number;
  children: number;
  budget_style: string;
  travel_style: string;
  transport: string;
  planner_version: string;
};

export type ItineraryDownloadedProps = {
  export_format: "pdf";
};

export type ItinerarySharedProps = {
  share_method: "email";
};

export type FeedbackSubmittedProps = {
  source: "floating_button" | "feedback_page";
};

/** Non-sensitive product properties derived from the current trip plan. */
export function itineraryProductProps(plan: TripPlan): ItineraryProductProps {
  return {
    destination: plan.destination,
    trip_length_days: getTripDayCount(plan.startDate, plan.endDate),
    adults: plan.adults,
    children: plan.children.length,
    budget_style: plan.budgetStyle || "",
    travel_style: plan.travelStyle || "",
    transport: plan.transportationType || "",
    planner_version: resolvePlannerEngine(),
  };
}

/**
 * PostHog is a large client dependency — load it only when capturing so the
 * wizard's first paint does not wait on the analytics bundle.
 */
type CaptureHandler = (
  event: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  properties?: Record<string, string | number | boolean>,
) => void;

const defaultCapture: CaptureHandler = (event, properties) => {
  void import("posthog-js")
    .then(({ default: posthog }) => {
      // PostHog is initialized client-side in PostHogProvider; no-op until then.
      if (!posthog.__loaded) return;
      posthog.capture(event, properties);
    })
    .catch(() => {
      /* ignore analytics load failures */
    });
};

let captureHandler: CaptureHandler = defaultCapture;

/** Test-only: swap in a sync capture implementation. */
export function setAnalyticsCaptureForTests(handler: CaptureHandler | null): void {
  captureHandler = handler ?? defaultCapture;
}

function capture(
  event: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  properties?: Record<string, string | number | boolean>,
): void {
  captureHandler(event, properties);
}

export function trackPlannerStarted(): void {
  capture(ANALYTICS_EVENTS.plannerStarted);
}

export function trackPlannerStepViewed(
  step: WizardStepId,
  stepIndex: number,
): void {
  capture(ANALYTICS_EVENTS.plannerStepViewed, {
    step,
    step_index: stepIndex,
  });
}

export function trackPlannerCompleted(properties: ItineraryProductProps): void {
  capture(ANALYTICS_EVENTS.plannerCompleted, properties);
}

export function trackItineraryGenerated(properties: ItineraryProductProps): void {
  capture(ANALYTICS_EVENTS.itineraryGenerated, properties);
}

export function trackItineraryViewed(properties: ItineraryProductProps): void {
  capture(ANALYTICS_EVENTS.itineraryViewed, properties);
}

export function trackItineraryDownloaded(
  properties: ItineraryDownloadedProps,
  engagementKey?: string,
): void {
  capture(ANALYTICS_EVENTS.itineraryDownloaded, properties);
  if (engagementKey) trackItineraryEngaged(engagementKey);
}

export function trackItineraryShared(
  properties: ItinerarySharedProps,
  engagementKey?: string,
): void {
  capture(ANALYTICS_EVENTS.itineraryShared, properties);
  if (engagementKey) trackItineraryEngaged(engagementKey);
}

export function trackFeedbackSubmitted(properties: FeedbackSubmittedProps): void {
  capture(ANALYTICS_EVENTS.feedbackSubmitted, properties);
}
