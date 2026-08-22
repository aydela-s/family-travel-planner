"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";
import type { ReactNode } from "react";

function StepCheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path
        d="M5 10.5 8.5 14 15 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Soft fill + check — completed quiet; selected dark-teal fill; locked dashed. */
function SoftCheckStepIndicator({
  index,
  active,
  completed,
  locked,
}: {
  index: number;
  active: boolean;
  completed: boolean;
  locked: boolean;
}) {
  if (active) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-white">
        {index + 1}
      </span>
    );
  }
  if (completed) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary">
        <StepCheckIcon />
      </span>
    );
  }
  if (locked) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-xs font-medium tabular-nums text-muted/50">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium tabular-nums text-muted">
      {index + 1}
    </span>
  );
}

/**
 * Shared chrome for /plan — used by the real wizard and by loading.tsx so the
 * first paint after “Plan my trip” already looks like step 1 (no spinner gap).
 */
export function WizardShell({
  children,
  stepIndex = 0,
  totalSteps = WIZARD_STEP_TITLES.length,
  unlockedThroughIndex = 0,
  footer,
  onSelectStep,
}: {
  children: ReactNode;
  stepIndex?: number;
  totalSteps?: number;
  stepTitle?: string;
  /** Last left-nav step that may be opened (first incomplete, or last if complete). */
  unlockedThroughIndex?: number;
  footer?: ReactNode;
  onSelectStep?: (index: number) => void;
}) {
  const titles = WIZARD_STEP_TITLES.slice(0, totalSteps);
  const currentTitle = titles[stepIndex] ?? "";
  const progressPct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-ink sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex text-ink transition hover:opacity-80">
          <FamilyTravelyLogo className="h-auto w-36 lg:w-48" />
        </Link>

        <div
          className="mt-4 border-b border-border pb-4 lg:hidden"
          aria-label={`Step ${stepIndex + 1} of ${totalSteps}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted">
              Step {stepIndex + 1} of {totalSteps}
            </p>
            <p className="truncate text-xs font-semibold text-primary">{currentTitle}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Plan steps" className="hidden lg:block">
            <ol className="space-y-1">
              {titles.map((title, index) => {
                const active = index === stepIndex;
                const locked = !onSelectStep || index > unlockedThroughIndex;
                const completed = !active && !locked && index < unlockedThroughIndex;
                return (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => {
                        if (locked || active) return;
                        onSelectStep?.(index);
                      }}
                      disabled={locked}
                      aria-current={active ? "step" : undefined}
                      className={`flex w-full items-center gap-2 rounded-full px-2 py-2 text-left text-sm ${
                        active
                          ? "font-semibold text-primary"
                          : locked
                            ? "cursor-not-allowed font-medium text-muted/50"
                            : "font-medium text-muted hover:bg-secondary-muted hover:text-ink"
                      }`}
                    >
                      <SoftCheckStepIndicator
                        index={index}
                        active={active}
                        completed={completed}
                        locked={locked}
                      />
                      {title}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
            {children}
            {footer}
          </div>
        </div>
      </div>
    </main>
  );
}
