"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

const primaryClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const outlineClassName =
  "inline-flex items-center justify-center rounded-full border-2 border-primary bg-white px-8 py-3.5 text-base font-semibold text-primary transition hover:bg-primary-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Warm the wizard client chunks before navigation so /plan isn't a blank wait. */
function warmPlanWizard() {
  void import("@/components/plan-wizard/TripPlanWizard");
  void import("@/components/plan-wizard/steps/WhereWhenStep");
  void import("@/components/DestinationAutocomplete");
}

export default function PlanMyTripLink({
  className = "",
  variant = "primary",
  children = "Plan My Trip",
}: {
  className?: string;
  variant?: "primary" | "outline";
  children?: ReactNode;
}) {
  const router = useRouter();

  function prefetchPlan() {
    router.prefetch("/plan");
    warmPlanWizard();
  }

  return (
    <Link
      href="/plan"
      className={`${variant === "outline" ? outlineClassName : primaryClassName} ${className}`.trim()}
      prefetch
      onPointerEnter={prefetchPlan}
      onFocus={prefetchPlan}
      onTouchStart={prefetchPlan}
    >
      {children}
    </Link>
  );
}
