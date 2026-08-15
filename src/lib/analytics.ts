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
  feedbackSubmitted: "feedback_submitted",
} as const;

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
function capture(
  event: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  properties?: Record<string, string | number | boolean>,
): void {
  void import("posthog-js")
    .then(({ default: posthog }) => {
      // PostHog is initialized client-side in PostHogProvider; no-op until then.
      if (!posthog.__loaded) return;
      posthog.capture(event, properties);
    })
    .catch(() => {
      /* ignore analytics load failures */
    });
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
): void {
  capture(ANALYTICS_EVENTS.itineraryDownloaded, properties);
}

export function trackItineraryShared(properties: ItinerarySharedProps): void {
  capture(ANALYTICS_EVENTS.itineraryShared, properties);
}

export function trackFeedbackSubmitted(properties: FeedbackSubmittedProps): void {
  capture(ANALYTICS_EVENTS.feedbackSubmitted, properties);
}
