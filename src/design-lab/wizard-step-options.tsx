"use client";

import { WIZARD_STEP_TITLES } from "@/lib/plan-wizard/step-gate";
import Link from "next/link";

/** Fixed demo: steps 0–1 complete, step 2 selected, steps 3–5 locked. */
const DEMO = { completedThrough: 1, selectedIndex: 2, unlockedThrough: 2 };

type StepState = "completed" | "selected" | "reachable" | "locked";

function stepState(index: number): StepState {
  if (index === DEMO.selectedIndex) return "selected";
  if (index <= DEMO.completedThrough) return "completed";
  if (index <= DEMO.unlockedThrough) return "reachable";
  return "locked";
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

type OptionId = "filled-check" | "soft-check" | "outline-check";

type IndicatorProps = {
  index: number;
  state: StepState;
};

function FilledCheckIndicator({ index, state }: IndicatorProps) {
  if (state === "completed") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <CheckIcon />
      </span>
    );
  }
  if (state === "selected") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-white">
        {index + 1}
      </span>
    );
  }
  if (state === "reachable") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 text-xs font-medium tabular-nums text-primary">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-xs font-medium tabular-nums text-muted/55">
      {index + 1}
    </span>
  );
}

function SoftCheckIndicator({ index, state }: IndicatorProps) {
  if (state === "completed") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary">
        <CheckIcon />
      </span>
    );
  }
  if (state === "selected") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-white">
        {index + 1}
      </span>
    );
  }
  if (state === "reachable") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium tabular-nums text-muted">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-xs font-medium tabular-nums text-muted/50">
      {index + 1}
    </span>
  );
}

function OutlineCheckIndicator({ index, state }: IndicatorProps) {
  if (state === "completed") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface text-primary">
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  }
  if (state === "selected") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-white ring-2 ring-primary/20 ring-offset-2">
        {index + 1}
      </span>
    );
  }
  if (state === "reachable") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium tabular-nums text-muted">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-xs font-medium tabular-nums text-muted/45">
      {index + 1}
    </span>
  );
}

const OPTIONS: {
  id: OptionId;
  title: string;
  summary: string;
  completed: string;
  selected: string;
  locked: string;
  Indicator: typeof FilledCheckIndicator;
  labelClass: (state: StepState) => string;
}[] = [
  {
    id: "filled-check",
    title: "A — Filled circle + check",
    summary: "Strongest contrast. Done steps match the selected fill but swap the number for a check.",
    completed: "Dark teal fill, white checkmark",
    selected: "Dark teal fill, white step number",
    locked: "Neutral outline, muted number",
    Indicator: FilledCheckIndicator,
    labelClass: (state) =>
      state === "selected"
        ? "font-semibold text-primary"
        : state === "completed"
          ? "font-medium text-muted"
          : state === "locked"
            ? "font-medium text-muted/55"
            : "font-medium text-muted",
  },
  {
    id: "soft-check",
    title: "B — Soft fill + check",
    summary: "Completed steps stay quiet. Only the current step gets the full dark-teal fill.",
    completed: "Light teal-muted fill, teal check",
    selected: "Dark teal fill, white step number",
    locked: "Dashed outline, faded number",
    Indicator: SoftCheckIndicator,
    labelClass: (state) =>
      state === "selected"
        ? "font-semibold text-primary"
        : state === "completed"
          ? "font-medium text-muted"
          : state === "locked"
            ? "font-medium text-muted/50"
            : "font-medium text-muted",
  },
  {
    id: "outline-check",
    title: "C — Outline ring + check",
    summary: "Completed steps keep a white center. Selected step adds a focus ring so it reads louder than done.",
    completed: "Teal ring, check inside, white fill",
    selected: "Filled teal + subtle ring",
    locked: "Flat neutral circle, low contrast",
    Indicator: OutlineCheckIndicator,
    labelClass: (state) =>
      state === "selected"
        ? "border-b-2 border-accent pb-0.5 font-semibold text-primary"
        : state === "completed"
          ? "font-medium text-muted"
          : state === "locked"
            ? "font-medium text-muted/45"
            : "font-medium text-muted",
  },
];

function StepNavPreview({
  optionId,
  Indicator,
  labelClass,
}: {
  optionId: OptionId;
  Indicator: typeof FilledCheckIndicator;
  labelClass: (state: StepState) => string;
}) {
  return (
    <nav aria-label={`Wizard steps — ${optionId}`}>
      <ol className="space-y-1">
        {WIZARD_STEP_TITLES.map((title, index) => {
          const state = stepState(index);
          const locked = state === "locked";
          return (
            <li key={title}>
              <div
                className={`flex w-full items-center gap-2 rounded-full px-2 py-2 text-left text-sm ${
                  locked ? "cursor-not-allowed" : state === "selected" ? "" : "hover:bg-secondary-muted"
                }`}
                aria-current={state === "selected" ? "step" : undefined}
              >
                <Indicator index={index} state={state} />
                <span className={labelClass(state)}>{title}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Legend({ completed, selected, locked }: { completed: string; selected: string; locked: string }) {
  return (
    <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted">
      <div>
        <dt className="font-semibold text-ink">Completed</dt>
        <dd>{completed}</dd>
      </div>
      <div>
        <dt className="font-semibold text-ink">Selected</dt>
        <dd>{selected}</dd>
      </div>
      <div>
        <dt className="font-semibold text-ink">Locked / future</dt>
        <dd>{locked}</dd>
      </div>
    </dl>
  );
}

export function WizardStepOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Wizard chrome</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Completed step indicators</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Three ways to show progress on the Harbor left nav. Each panel uses the same story: steps 1–2 are done, step 3
          is selected, steps 4–6 are locked until earlier steps stay complete.
        </p>
        <p className="mt-2 text-sm text-muted">
          <Link href="/design-lab/harbor/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Open live Harbor wizard
          </Link>
          {" · "}
          Harbor now uses option B (soft fill + check, no strikethrough).
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {OPTIONS.map((option) => (
            <article
              key={option.id}
              className="flex flex-col rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <h2 className="text-lg font-semibold text-ink">{option.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{option.summary}</p>
              <div className="mt-6 flex-1 rounded-2xl bg-background p-4">
                <StepNavPreview optionId={option.id} Indicator={option.Indicator} labelClass={option.labelClass} />
              </div>
              <Legend completed={option.completed} selected={option.selected} locked={option.locked} />
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-[1.75rem] border border-border bg-surface p-6 text-sm text-muted shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold text-ink">Shared rules (all options)</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Hover uses light teal wash only on steps you can open — not on locked steps.</li>
            <li>Selected is visually stronger than completed (fill vs check, or ring vs outline).</li>
            <li>Coral appears only on option C&apos;s selected underline — not on completed icons.</li>
            <li>Locked steps: no pointer cursor, reduced label contrast, no brand-color fill.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
