"use client";

import { useState } from "react";
import Link from "next/link";
import { StepIntro } from "@/components/plan-wizard/shared";

type Pace = "relaxed" | "balanced" | "packed";
type Budget = "save" | "balanced" | "splurge";

const PACE: { value: Pace; label: string; hint: string }[] = [
  { value: "relaxed", label: "Relaxed", hint: "Fewer stops, more downtime" },
  { value: "balanced", label: "Balanced", hint: "A solid mix each day" },
  { value: "packed", label: "Packed", hint: "See more, move faster" },
];

const BUDGET: { value: Budget; label: string; hint: string }[] = [
  { value: "save", label: "Save", hint: "Keep costs down" },
  { value: "balanced", label: "Comfortable", hint: "Worth it when it counts" },
  { value: "splurge", label: "Splurge", hint: "Treat yourselves" },
];

const PACE_LEVEL: Record<Pace, 1 | 2 | 3> = { relaxed: 1, balanced: 2, packed: 3 };
const BUDGET_LEVEL: Record<Budget, 1 | 2 | 3> = { save: 1, balanced: 2, splurge: 3 };

function WizardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
      {children}
    </div>
  );
}

function usePaceBudget(initialPace: Pace = "balanced", initialBudget: Budget = "balanced") {
  const [pace, setPace] = useState<Pace>(initialPace);
  const [budget, setBudget] = useState<Budget>(initialBudget);
  return { pace, setPace, budget, setBudget };
}

/** Always show 3 slots; unused ones stay faded. */
function DollarMeterFaded({ level, onPrimary }: { level: 1 | 2 | 3; onPrimary?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 text-xl font-bold tracking-tight" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={
            n <= level
              ? onPrimary
                ? "text-white"
                : "text-primary"
              : onPrimary
                ? "text-white/35"
                : "text-muted/35"
          }
        >
          $
        </span>
      ))}
    </span>
  );
}

/** Only render as many $ as the level (1 / 2 / 3). */
function DollarMeterCount({ level, onPrimary }: { level: 1 | 2 | 3; onPrimary?: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 text-xl font-bold tracking-tight ${
        onPrimary ? "text-white" : "text-primary"
      }`}
      aria-hidden
    >
      {Array.from({ length: level }, (_, i) => (
        <span key={i}>$</span>
      ))}
    </span>
  );
}

function PaceBarsFaded({ level, onPrimary }: { level: 1 | 2 | 3; onPrimary?: boolean }) {
  const heights = ["h-3", "h-5", "h-7"] as const;
  return (
    <span className="inline-flex items-end gap-1" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`w-2.5 rounded-sm ${heights[n - 1]} ${
            n <= level
              ? onPrimary
                ? "bg-white"
                : "bg-primary"
              : onPrimary
                ? "bg-white/30"
                : "bg-muted/30"
          }`}
        />
      ))}
    </span>
  );
}

function PaceBarsCount({ level, onPrimary }: { level: 1 | 2 | 3; onPrimary?: boolean }) {
  const heights = ["h-3", "h-5", "h-7"] as const;
  return (
    <span className="inline-flex items-end gap-1" aria-hidden>
      {Array.from({ length: level }, (_, i) => (
        <span
          key={i}
          className={`w-2.5 rounded-sm ${heights[i]} ${onPrimary ? "bg-white" : "bg-primary"}`}
        />
      ))}
    </span>
  );
}

/** E — Progressive meters, side by side only (dark / faded). */
function OptionESideBySide() {
  const { pace, setPace, budget, setBudget } = usePaceBudget();

  return (
    <WizardFrame>
      <div className="space-y-5">
        <StepIntro
          emoji="🎒"
          title="Pace & spend"
          subtitle="Side by side — dark steps vs faded steps."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-ink">Pace</p>
            <div className="mt-3 flex justify-between gap-2">
              {PACE.map((opt) => {
                const on = pace === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPace(opt.value)}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-xl border py-5 transition ${
                      on
                        ? "border-primary bg-primary-muted"
                        : "border-transparent hover:border-ink/40"
                    }`}
                  >
                    <PaceBarsFaded level={PACE_LEVEL[opt.value]} />
                    <span className={`text-xs font-semibold ${on ? "text-primary" : "text-muted"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-ink">Spend</p>
            <div className="mt-3 flex justify-between gap-2">
              {BUDGET.map((opt) => {
                const on = budget === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBudget(opt.value)}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-xl border py-5 transition ${
                      on
                        ? "border-primary bg-primary-muted"
                        : "border-transparent hover:border-ink/40"
                    }`}
                  >
                    <DollarMeterFaded level={BUDGET_LEVEL[opt.value]} />
                    <span className={`text-xs font-semibold ${on ? "text-primary" : "text-muted"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </WizardFrame>
  );
}

type MeterMode = "count" | "faded";

/** D — Twin circle pickers using the meter UI. */
function OptionDCircles({ mode }: { mode: MeterMode }) {
  const { pace, setPace, budget, setBudget } = usePaceBudget(
    mode === "count" ? "relaxed" : "packed",
    mode === "count" ? "save" : "splurge",
  );

  const PaceMeter = mode === "count" ? PaceBarsCount : PaceBarsFaded;
  const DollarMeter = mode === "count" ? DollarMeterCount : DollarMeterFaded;

  return (
    <WizardFrame>
      <div className="space-y-6">
        <StepIntro
          emoji="🎒"
          title="Pace & spend"
          subtitle={
            mode === "count"
              ? "Circles with count-only meters — one mark for lowest, two for medium, three for full."
              : "Circles with dark / faded meters — always three slots, unused ones stay light."
          }
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pace</p>
            <div className="mt-4 flex justify-center gap-3">
              {PACE.map((opt) => {
                const on = pace === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => setPace(opt.value)}
                    className={`flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full border-2 transition ${
                      on
                        ? "border-primary bg-primary ring-2 ring-primary/20"
                        : "border-border bg-background hover:border-secondary"
                    }`}
                  >
                    <PaceMeter level={PACE_LEVEL[opt.value]} onPrimary={on} />
                    <span className="sr-only">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">
              {PACE.find((p) => p.value === pace)?.label}
            </p>
            <p className="text-xs text-muted">{PACE.find((p) => p.value === pace)?.hint}</p>
          </div>

          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Spend</p>
            <div className="mt-4 flex justify-center gap-3">
              {BUDGET.map((opt) => {
                const on = budget === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => setBudget(opt.value)}
                    className={`flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full border-2 transition ${
                      on
                        ? "border-primary bg-primary ring-2 ring-primary/20"
                        : "border-border bg-background hover:border-secondary"
                    }`}
                  >
                    <DollarMeter level={BUDGET_LEVEL[opt.value]} onPrimary={on} />
                    <span className="sr-only">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">
              {BUDGET.find((b) => b.value === budget)?.label}
            </p>
            <p className="text-xs text-muted">{BUDGET.find((b) => b.value === budget)?.hint}</p>
          </div>
        </div>
      </div>
    </WizardFrame>
  );
}

const OPTIONS = [
  {
    id: "e-side",
    letter: "E",
    title: "Side-by-side panels (dark / faded)",
    summary:
      "Pace | Spend in two panels. Always three bars or dollar signs — lit steps are dark teal, unused ones stay faded.",
    Component: OptionESideBySide,
  },
  {
    id: "d-count",
    letter: "D1",
    title: "Circles · count only",
    summary:
      "Option D layout with meters that only show 1 / 2 / 3 marks — lowest has a single bar or $, no faded leftovers.",
    Component: () => <OptionDCircles mode="count" />,
  },
  {
    id: "d-faded",
    letter: "D2",
    title: "Circles · dark / faded",
    summary:
      "Same Option D circles, but always three slots — filled steps dark, unused steps light (same language as E).",
    Component: () => <OptionDCircles mode="faded" />,
  },
] as const;

export function PaceBudgetOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Wizard · Pace & spend</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pace & budget — meter variants</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Option E side-by-side, plus two Option D circle takes: count-only vs dark/faded.
        </p>
        <p className="mt-2 text-sm text-muted">
          Current reference:{" "}
          <Link href="/design-lab/harbor/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Harbor wizard
          </Link>
          {" · "}
          production uses option E (side-by-side progressive meters).
        </p>

        <div className="mt-10 space-y-14">
          {OPTIONS.map(({ id, letter, title, summary, Component }) => (
            <section key={id} className="scroll-mt-24">
              <div className="mb-4 max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Option {letter}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{summary}</p>
              </div>
              <Component />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
