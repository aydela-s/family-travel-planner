"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import PlanLoading from "./loading";

/**
 * Load the wizard as a separate client chunk. PrefetchPlan / PlanMyTripLink
 * warm this import so navigation usually swaps skeleton → step 1 immediately.
 */
const TripPlanWizard = dynamic(
  () => import("@/components/plan-wizard/TripPlanWizard"),
  {
    ssr: false,
    loading: () => <PlanLoading />,
  },
);

export default function PlanPage() {
  return (
    <Suspense fallback={<PlanLoading />}>
      <TripPlanWizard />
    </Suspense>
  );
}
