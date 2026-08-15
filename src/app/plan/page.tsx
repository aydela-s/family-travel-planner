import { Suspense } from "react";
import TripPlanWizard from "@/components/plan-wizard/TripPlanWizard";
import PlanLoading from "./loading";

export default function PlanPage() {
  return (
    <Suspense fallback={<PlanLoading />}>
      <TripPlanWizard />
    </Suspense>
  );
}
