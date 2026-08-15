"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function warmPlanWizard() {
  void import("@/components/plan-wizard/TripPlanWizard");
  void import("@/components/plan-wizard/steps/DestinationStep");
  void import("@/components/DestinationAutocomplete");
  void import("@/components/plan-wizard/steps/DatesStep");
}

/**
 * Silently warm `/plan` RSC + the destination-first wizard chunk while the
 * landing page is idle — so “Plan my trip” can paint step 1 immediately.
 */
export default function PrefetchPlan() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/plan");
    // Start immediately; idle callback was often too late if the user clicked fast.
    warmPlanWizard();

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    const id = idle(() => {
      warmPlanWizard();
    });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id as number);
      } else {
        window.clearTimeout(id as number);
      }
    };
  }, [router]);

  return null;
}
