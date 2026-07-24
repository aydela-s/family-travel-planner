import { Suspense } from "react";
import TripPlanWizard from "@/components/plan-wizard/TripPlanWizard";
import LoadingScreen from "@/components/LoadingScreen";

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
            <LoadingScreen message="Loading…" />
          </div>
        </main>
      }
    >
      <TripPlanWizard />
    </Suspense>
  );
}
