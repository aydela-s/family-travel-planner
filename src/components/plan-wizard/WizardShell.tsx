import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome for /plan — used by the real wizard and by loading.tsx so the
 * first paint after “Plan my trip” already looks like step 1 (no spinner gap).
 */
export function WizardShell({
  children,
  stepIndex = 0,
  totalSteps = 10,
  stepTitle = "Destination",
  footer,
}: {
  children: ReactNode;
  stepIndex?: number;
  totalSteps?: number;
  stepTitle?: string;
  footer?: ReactNode;
}) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-primary transition hover:opacity-80"
        >
          <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>

        <div className="mt-6 rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-muted">
              <span className="font-medium">
                {stepIndex + 1} of {totalSteps}
              </span>
              <span className="font-semibold text-accent">{stepTitle}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {stepIndex === 0 && (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Let&apos;s plan something your whole family will love.
              </p>
            )}
          </div>

          {children}
          {footer}
        </div>
      </div>
    </main>
  );
}
