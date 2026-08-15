import { afterEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: (...args: unknown[]) => capture(...args),
  },
}));

import {
  ANALYTICS_EVENTS,
  itineraryProductProps,
  trackFeedbackSubmitted,
  trackItineraryDownloaded,
  trackItineraryGenerated,
  trackItineraryShared,
  trackItineraryViewed,
  trackPlannerCompleted,
  trackPlannerStarted,
  trackPlannerStepViewed,
} from "@/lib/analytics";
import { WIZARD_STEP_IDS, WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import type { TripPlan } from "@/types/trip-plan";

afterEach(() => {
  capture.mockClear();
});

const samplePlan: TripPlan = {
  destination: "San Diego",
  startDate: "2026-07-28",
  endDate: "2026-08-01",
  adults: 2,
  children: [4, 8],
  travelStyle: "balanced",
  walkingLimit: "medium",
  transportationType: "car-rental",
  accommodationType: "hotel_breakfast_included",
  dietaryRestrictions: "",
  naps: [],
  budgetStyle: "save",
  interests: ["Beaches & Waterfronts"],
};

describe("analytics helper", () => {
  it("keeps wizard step IDs aligned with titles", () => {
    expect(WIZARD_STEP_IDS).toHaveLength(WIZARD_STEP_TITLES.length);
  });

  it("builds non-sensitive itinerary product props", () => {
    expect(itineraryProductProps(samplePlan)).toEqual({
      destination: "San Diego",
      trip_length_days: 5,
      adults: 2,
      children: 2,
      budget_style: "save",
      travel_style: "balanced",
      transport: "car-rental",
      planner_version: "staged",
    });
  });

  it("emits the product funnel events with centralized names", () => {
    trackPlannerStarted();
    trackPlannerStepViewed("destination", 0);
    trackPlannerCompleted(itineraryProductProps(samplePlan));
    trackItineraryGenerated(itineraryProductProps(samplePlan));
    trackItineraryViewed(itineraryProductProps(samplePlan));
    trackItineraryDownloaded({ export_format: "pdf" });
    trackItineraryShared({ share_method: "email" });
    trackFeedbackSubmitted({ source: "floating_button" });

    expect(capture.mock.calls.map((c) => c[0])).toEqual([
      ANALYTICS_EVENTS.plannerStarted,
      ANALYTICS_EVENTS.plannerStepViewed,
      ANALYTICS_EVENTS.plannerCompleted,
      ANALYTICS_EVENTS.itineraryGenerated,
      ANALYTICS_EVENTS.itineraryViewed,
      ANALYTICS_EVENTS.itineraryDownloaded,
      ANALYTICS_EVENTS.itineraryShared,
      ANALYTICS_EVENTS.feedbackSubmitted,
    ]);
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.plannerStepViewed, {
      step: "destination",
      step_index: 0,
    });
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.itineraryDownloaded, {
      export_format: "pdf",
    });
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.itineraryShared, {
      share_method: "email",
    });
  });
});
