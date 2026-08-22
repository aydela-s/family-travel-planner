"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { BRAND } from "@/config/brand";
import { LAB_SCREENS, type LabScreen } from "./concepts";

type MobileDir = "pick" | "a" | "b" | "c";

type Nav = {
  goHome: () => void;
  goWizard: () => void;
  goItinerary: () => void;
};

const DIRECTIONS: { id: MobileDir; title: string; summary: string }[] = [
  {
    id: "pick",
    title: "Your pick",
    summary:
      "Home: A hero stack then B how/why + bottom CTA. Wizard: A (Step X of Y). Itinerary: B layout, adults/kids line, C-style chip menus. Production web colors.",
  },
  {
    id: "a",
    title: "A · Scroll & compact",
    summary:
      "Homepage: production stack (copy → CTA → hero → how → why). Wizard: Step X of Y + progress. Itinerary: sideways chips + dropdown.",
  },
  {
    id: "b",
    title: "B · Sticky actions",
    summary:
      "Homepage: full-bleed hero with sticky Plan My Trip. Wizard: pinned Back/Continue. Itinerary: chip bottom sheet.",
  },
  {
    id: "c",
    title: "C · Dense summary",
    summary:
      "Homepage: tight first screen + compact how/why list. Wizard: horizontal step pills. Itinerary: wrap chips.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Tell us about your family",
    body: "Kids’ ages, travel pace, food needs, and budget style. These are the details that actually change a day.",
  },
  {
    step: "2",
    title: "Get a day-by-day plan",
    body: "Activities, meals, and downtime sequenced for real family energy, not a packed tourist checklist.",
  },
  {
    step: "3",
    title: "Review and go",
    body: "Tweak what you need, then share or take the itinerary with you.",
  },
] as const;

const WHY_FAMILYTRAVELY = [
  {
    title: "Built around your kids",
    body: "Ages, naps, and energy levels shape what we schedule so the plan survives the afternoon.",
  },
  {
    title: "Your pace, not a checklist",
    body: "We leave room to breathe between stops instead of stacking every landmark into one day.",
  },
  {
    title: "Budget style that means something",
    body: "Save, comfortable, or splurge changes the kinds of activities and meals we pick, not a fake dollar target.",
  },
] as const;

const WIZARD_STEPS = [
  { id: "where", short: "Where", title: "Where & when", hint: "Dallas · Aug 24–27" },
  { id: "travelers", short: "Travelers", title: "Who’s coming?", hint: "2 adults · 2 kids" },
  { id: "stay", short: "Stay", title: "Where are you staying?", hint: "Pick the option that fits." },
  { id: "pace", short: "Pace", title: "Pace & spend", hint: "How full should days feel?" },
  { id: "food", short: "Food", title: "Food & naps", hint: "Any dietary needs?" },
  { id: "interests", short: "Interests", title: "What sounds fun?", hint: "Pick a few." },
] as const;

const STAY_OPTS = ["Hotel", "Rental", "Family / friends", "Not sure yet"] as const;
const TRANSIT_OPTS = ["Car", "Taxi", "Public transit"] as const;
const PACE_OPTS = ["Relaxed", "Balanced", "Packed"] as const;
const BUDGET_OPTS = ["Save", "Comfortable", "Splurge"] as const;

const CTA =
  "inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover";

/** Production web card surface (How it works / Why sections) */
const WEB_CARD = "rounded-[1.25rem] border border-secondary/20 bg-secondary-muted/35";

const WIZARD_PRIMARY_BTN =
  "flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-hover";

const WIZARD_ACCENT_BTN =
  "flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover";

function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="w-[min(100%,22rem)] overflow-hidden rounded-[1.75rem] border-[3px] border-ink/80 bg-background shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-center bg-ink/90 py-1.5">
          <span className="h-1 w-16 rounded-full bg-white/30" aria-hidden />
        </div>
        <div className="relative h-[36rem] overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

function FlowDownArrow() {
  return (
    <div aria-hidden className="flex justify-center py-2 text-secondary">
      <svg width="12" height="28" viewBox="0 0 12 28" fill="none">
        <path
          d="M6 0v22M1.5 18 6 24.5 10.5 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const HOME_HEADLINE = "Plan a family trip that actually works";
const HOME_SUB =
  "Personalized day-by-day itineraries built around your kids, your pace, and your budget without the hours of planning.";

function PinIcon({ className = "h-6 w-6 shrink-0 text-primary" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 21s7-4.8 7-10.5a7 7 0 1 0-14 0C5 16.2 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Your pick · A top through hero, then B how/why + bottom CTA (web card colors) */
function HomePick({ nav }: { nav: Nav }) {
  return (
    <div className="bg-background text-ink">
      <section className="border-b border-border px-4 py-6">
        <FamilyTravelyLogo className="h-auto w-36" />
        <h1 className="mt-6 text-[1.65rem] font-semibold leading-tight tracking-tight text-primary">{HOME_HEADLINE}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{HOME_SUB}</p>
        <button type="button" onClick={nav.goWizard} className={`${CTA} mt-5`}>
          Plan My Trip
        </button>
        <p className="mt-2 text-sm text-muted">Start planning for free. No account needed.</p>
        <p className="sr-only">{BRAND.slogan}</p>
      </section>

      <aside className="relative h-44 overflow-hidden border-b border-border">
        <Image
          src="/homepage-hero-family.jpg"
          alt="A family walking together through a sunny city square"
          fill
          sizes="22rem"
          className="object-cover object-[center_35%]"
        />
      </aside>

      <div className="px-4 pt-6 pb-8">
        <h2 className="text-lg font-semibold tracking-tight text-primary">How it works</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Three steps from family details to a plan you can actually follow.
        </p>
        <ol className="mt-4 space-y-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className={`flex gap-3 p-3 ${WEB_CARD}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {item.step}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-6 text-lg font-semibold tracking-tight text-primary">Why {BRAND.name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Most trip planners ignore how families actually move through a day. We plan for that from the start.
        </p>
        <ul className="mt-4 space-y-3">
          {WHY_FAMILYTRAVELY.map((item) => (
            <li key={item.title} className={`p-3 ${WEB_CARD}`}>
              <span aria-hidden className="mb-2 block h-1 w-7 rounded-full bg-accent" />
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <button type="button" onClick={nav.goWizard} className={CTA}>
            Plan My Trip
          </button>
        </div>
      </div>
    </div>
  );
}

/** A · Production mobile stack: copy → CTA → hero → how → why */
function HomeA({ nav }: { nav: Nav }) {
  return (
    <div className="bg-background text-ink">
      <section className="border-b border-border px-4 py-6">
        <FamilyTravelyLogo className="h-auto w-36" />
        <h1 className="mt-6 text-[1.65rem] font-semibold leading-tight tracking-tight text-primary">{HOME_HEADLINE}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{HOME_SUB}</p>
        <button type="button" onClick={nav.goWizard} className={`${CTA} mt-5`}>
          Plan My Trip
        </button>
        <p className="mt-2 text-sm text-muted">Start planning for free. No account needed.</p>
        <p className="sr-only">{BRAND.slogan}</p>
      </section>

      <aside className="relative h-44 overflow-hidden">
        <Image
          src="/homepage-hero-family.jpg"
          alt="A family walking together through a sunny city square"
          fill
          sizes="22rem"
          className="object-cover object-[center_35%]"
        />
      </aside>

      <section className="border-t border-border bg-surface px-4 py-8">
        <h2 className="text-center text-xl font-semibold tracking-tight text-primary">How it works</h2>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-muted">
          Three steps from family details to a plan you can actually follow.
        </p>
        <ol className="mt-6 flex flex-col">
          {HOW_IT_WORKS.map((item, index) => (
            <li key={item.step} className="flex flex-col">
              <div className="rounded-[1.25rem] border border-secondary/20 bg-secondary-muted/35 p-4 text-left">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {item.step}
                </span>
                <h3 className="mt-3 text-base font-semibold tracking-tight text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
              {index < HOW_IT_WORKS.length - 1 ? <FlowDownArrow /> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border px-4 py-8">
        <h2 className="text-center text-xl font-semibold tracking-tight text-primary">Why {BRAND.name}</h2>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-muted">
          Most trip planners ignore how families actually move through a day. We plan for that from the start.
        </p>
        <ul className="mt-6 space-y-3">
          {WHY_FAMILYTRAVELY.map((item) => (
            <li key={item.title}>
              <div className="rounded-[1.25rem] border border-secondary/20 bg-secondary-muted/35 p-4 text-left">
                <span aria-hidden className="mb-3 block h-1 w-8 rounded-full bg-accent" />
                <h3 className="text-base font-semibold tracking-tight text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex justify-center pb-4">
          <button type="button" onClick={nav.goWizard} className={CTA}>
            Plan My Trip
          </button>
        </div>
      </section>
    </div>
  );
}

/** B · Image-led hero + sticky bottom CTA; how/why scroll underneath */
function HomeB({ nav }: { nav: Nav }) {
  return (
    <div className="relative flex min-h-[36rem] flex-col bg-background text-ink">
      <div className="relative h-[17rem] shrink-0 overflow-hidden">
        <Image
          src="/homepage-hero-family.jpg"
          alt="A family walking together through a sunny city square"
          fill
          sizes="22rem"
          className="object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/35 to-ink/10" />
        <div className="absolute inset-x-0 top-0 px-4 pt-5">
          <FamilyTravelyLogo className="h-auto w-32 brightness-0 invert" />
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5">
          <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-white">{HOME_HEADLINE}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/85">{HOME_SUB}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-5">
        <p className="text-xs text-muted">Start planning for free. No account needed.</p>
        <h2 className="mt-5 text-lg font-semibold tracking-tight text-primary">How it works</h2>
        <ol className="mt-3 space-y-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {item.step}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <h2 className="mt-6 text-lg font-semibold tracking-tight text-primary">Why {BRAND.name}</h2>
        <ul className="mt-3 space-y-3">
          {WHY_FAMILYTRAVELY.map((item) => (
            <li key={item.title} className="rounded-2xl border border-border bg-surface p-3">
              <span aria-hidden className="mb-2 block h-1 w-7 rounded-full bg-accent" />
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface/95 p-3 backdrop-blur">
        <button type="button" onClick={nav.goWizard} className={CTA}>
          Plan My Trip
        </button>
      </div>
    </div>
  );
}

/** C · Dense first screen: logo + headline + CTA in one view; compact how/why below */
function HomeC({ nav }: { nav: Nav }) {
  return (
    <div className="relative flex min-h-[36rem] flex-col bg-background text-ink">
      <div className="flex-1 overflow-y-auto pb-20">
        <section className="border-b border-border px-4 pt-5">
          <FamilyTravelyLogo className="h-auto w-28" />
          <div className="mt-4 grid grid-cols-[1fr_5.5rem] gap-3">
            <div>
              <h1 className="text-xl font-semibold leading-tight tracking-tight text-primary">{HOME_HEADLINE}</h1>
              <p className="mt-2 text-xs leading-relaxed text-muted">{HOME_SUB}</p>
            </div>
            <div className="relative h-24 overflow-hidden rounded-xl">
              <Image
                src="/homepage-hero-family.jpg"
                alt=""
                fill
                sizes="6rem"
                className="object-cover object-[center_35%]"
              />
            </div>
          </div>
          <p className="mt-3 pb-4 text-xs text-muted">Free · No account needed</p>
        </section>

        <section className="border-b border-border px-4 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</h2>
          <ol className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.step} className="flex gap-3 px-3 py-3">
                <span className="text-sm font-bold text-primary">{item.step}</span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="px-4 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Why {BRAND.name}</h2>
          <ul className="mt-3 space-y-2">
            {WHY_FAMILYTRAVELY.map((item) => (
              <li key={item.title} className="border-l-2 border-accent pl-3">
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5">
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted">Day-by-day plans for real family days</p>
        <button
          type="button"
          onClick={nav.goWizard}
          className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-[var(--shadow-accent)]"
        >
          Plan My Trip
        </button>
      </div>
    </div>
  );
}

function useWizardState(nav: Nav) {
  const [step, setStep] = useState(2);
  const [stay, setStay] = useState("Family / friends");
  const [transit, setTransit] = useState("Taxi");
  const [pace, setPace] = useState("Balanced");
  const [budget, setBudget] = useState("Comfortable");

  const current = WIZARD_STEPS[step]!;
  const progress = ((step + 1) / WIZARD_STEPS.length) * 100;

  function back() {
    if (step === 0) nav.goHome();
    else setStep((s) => s - 1);
  }

  function next() {
    if (step >= WIZARD_STEPS.length - 1) nav.goItinerary();
    else setStep((s) => s + 1);
  }

  return { step, setStep, stay, setStay, transit, setTransit, pace, setPace, budget, setBudget, current, progress, back, next };
}

function WizardBody({
  state,
}: {
  state: ReturnType<typeof useWizardState>;
}) {
  const { current, stay, setStay, transit, setTransit, pace, setPace, budget, setBudget } = state;

  if (current.id === "stay") {
    return (
      <>
        <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-1 text-sm text-muted">{current.hint}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {STAY_OPTS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setStay(label)}
              className={`rounded-2xl border px-3 py-4 text-left text-sm font-semibold transition ${
                stay === label
                  ? "border-primary bg-primary-muted text-primary"
                  : "border-border bg-surface text-ink hover:border-ink/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (current.id === "pace") {
    return (
      <>
        <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-1 text-sm text-muted">{current.hint}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Pace</p>
        <div className="mt-2 flex gap-2">
          {PACE_OPTS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setPace(label)}
              className={`flex-1 rounded-2xl border py-3 text-xs font-semibold ${
                pace === label ? "border-primary bg-primary-muted text-primary" : "border-border bg-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Spend</p>
        <div className="mt-2 flex gap-2">
          {BUDGET_OPTS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setBudget(label)}
              className={`flex-1 rounded-2xl border py-3 text-xs font-semibold ${
                budget === label ? "border-primary bg-primary-muted text-primary" : "border-border bg-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (current.id === "where" || current.id === "travelers" || current.id === "food" || current.id === "interests") {
    return (
      <>
        <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
        <p className="mt-1 text-sm text-muted">{current.hint}</p>
        <div className="mt-4 rounded-2xl border border-border bg-surface px-4 py-6 text-sm text-muted">
          Preview step — tap Next to continue. (Stay / Pace are fully interactive.)
        </div>
        {current.id === "where" ? (
          <div className="mt-3 space-y-2">
            {TRANSIT_OPTS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setTransit(label)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  transit === label ? "border-primary bg-primary-muted text-primary" : "border-border bg-surface"
                }`}
              >
                {label}
                {transit === label ? <span aria-hidden>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return null;
}

function WizardA({ nav }: { nav: Nav }) {
  const state = useWizardState(nav);
  const { step, current, progress, back, next } = state;

  return (
    <div className="flex h-full min-h-[36rem] flex-col bg-background text-ink">
      <div className="border-b border-border px-4 py-3">
        <button type="button" onClick={nav.goHome} className="inline-flex">
          <FamilyTravelyLogo className="h-auto w-28" />
        </button>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted">
            Step {step + 1} of {WIZARD_STEPS.length}
          </p>
          <p className="truncate text-xs font-semibold text-primary">{current.short}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <WizardBody state={state} />
      </div>
      <div className="flex gap-2 border-t border-border bg-surface p-3">
        <button type="button" onClick={back} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className={step >= WIZARD_STEPS.length - 1 ? WIZARD_ACCENT_BTN : WIZARD_PRIMARY_BTN}
        >
          {step >= WIZARD_STEPS.length - 1 ? "Generate" : "Next"}
        </button>
      </div>
    </div>
  );
}

function WizardB({ nav }: { nav: Nav }) {
  const state = useWizardState(nav);
  const { step, current, back, next } = state;

  return (
    <div className="relative flex h-full min-h-[36rem] flex-col bg-background text-ink">
      <div className="px-4 py-3">
        <button type="button" onClick={nav.goHome} className="inline-flex">
          <FamilyTravelyLogo className="h-auto w-28" />
        </button>
        <div className="mt-3 flex gap-1.5">
          {WIZARD_STEPS.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Go to step ${n + 1}`}
              onClick={() => state.setStep(n)}
              className={`h-1.5 flex-1 rounded-full transition ${n <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">{current.title}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <WizardBody state={state} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-border bg-surface p-3">
        <button type="button" onClick={back} className="w-24 rounded-full border border-border py-3 text-sm font-semibold">
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-white"
        >
          {step >= WIZARD_STEPS.length - 1 ? "Generate" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function WizardC({ nav }: { nav: Nav }) {
  const state = useWizardState(nav);
  const { step, current, back, next, setStep } = state;

  return (
    <div className="flex h-full min-h-[36rem] flex-col bg-background text-ink">
      <div className="border-b border-border px-3 py-3">
        <button type="button" onClick={nav.goHome} className="inline-flex">
          <FamilyTravelyLogo className="h-auto w-24" />
        </button>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                i === step
                  ? "bg-primary text-white"
                  : i < step
                    ? "bg-primary-muted text-primary"
                    : "bg-border/60 text-muted"
              }`}
            >
              {i < step ? "✓ " : ""}
              {s.short}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <WizardBody state={state} />
        <p className="mt-3 text-xs text-muted">On {current.short}</p>
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <button type="button" onClick={back} className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold">
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white"
        >
          {step >= WIZARD_STEPS.length - 1 ? "Generate" : "Next"}
        </button>
      </div>
    </div>
  );
}

type ChipState = {
  naps: string;
  stay: string;
  transit: string;
  pace: string;
  budget: string;
  interests: string;
};

const INITIAL_CHIPS: ChipState = {
  naps: "12:30–2",
  stay: "Family",
  transit: "Taxi",
  pace: "Balanced",
  budget: "Comfortable",
  interests: "4 interests",
};

const CHIP_OPTIONS: Partial<Record<keyof ChipState, string[]>> = {
  transit: [...TRANSIT_OPTS],
  pace: [...PACE_OPTS],
  budget: [...BUDGET_OPTS],
};

function useChips() {
  const [chips, setChips] = useState<ChipState>(INITIAL_CHIPS);
  const [open, setOpen] = useState<keyof ChipState | null>(null);

  function select(key: keyof ChipState, value: string) {
    setChips((c) => ({ ...c, [key]: value }));
    setOpen(null);
  }

  function toggle(key: keyof ChipState) {
    setOpen((o) => (o === key ? null : key));
  }

  return { chips, open, select, toggle, setOpen };
}

const CHIP_META: { key: keyof ChipState; label: string }[] = [
  { key: "naps", label: "Naps" },
  { key: "stay", label: "Stay" },
  { key: "transit", label: "Transit" },
  { key: "pace", label: "Pace" },
  { key: "budget", label: "Budget" },
  { key: "interests", label: "Interests" },
];

function ChipMenu({
  chipKey,
  value,
  onSelect,
  onClose,
  onWizard,
}: {
  chipKey: keyof ChipState;
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  onWizard: () => void;
}) {
  const options = CHIP_OPTIONS[chipKey];
  if (options) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)]">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onSelect(o)}
            className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${
              o === value ? "font-semibold text-primary" : "text-ink hover:bg-primary-muted/50"
            }`}
          >
            {o}
            {o === value ? <span aria-hidden>✓</span> : null}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center shadow-[var(--shadow-card)]">
      <p className="text-xs text-muted">{CHIP_META.find((c) => c.key === chipKey)?.label} opens in the wizard</p>
      <button
        type="button"
        onClick={onWizard}
        className="mt-2 w-full rounded-lg bg-primary px-2.5 py-2 text-xs font-semibold text-white"
      >
        Open wizard step
      </button>
      <button type="button" onClick={onClose} className="mt-1 w-full py-1 text-xs text-muted">
        Cancel
      </button>
    </div>
  );
}

function ItineraryA({ nav }: { nav: Nav }) {
  const { chips, open, select, toggle, setOpen } = useChips();
  const [day, setDay] = useState(0);

  return (
    <div className="bg-background text-ink">
      <div className="px-4 pb-3 pt-4">
        <button type="button" onClick={nav.goHome} className="inline-flex">
          <FamilyTravelyLogo className="h-auto w-28" />
        </button>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Dallas</h2>
        <p className="mt-1 text-sm text-muted">Aug 24–27 · 2 adults · 2 kids</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
            Share
          </button>
          <button type="button" onClick={nav.goWizard} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
            Edit plan
          </button>
        </div>
      </div>
      <div className="px-4">
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="flex snap-x snap-mandatory overflow-x-auto divide-x divide-border">
            {CHIP_META.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`min-w-[7.25rem] shrink-0 snap-start px-3 py-2.5 text-left transition ${
                  open === c.key ? "bg-primary-muted" : "bg-surface"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                <p className={`mt-0.5 truncate text-sm font-semibold ${open === c.key ? "text-primary" : "text-ink"}`}>
                  {chips[c.key]}
                </p>
              </button>
            ))}
          </div>
        </div>
        {open ? (
          <div className="mt-1.5">
            <ChipMenu
              chipKey={open}
              value={chips[open]}
              onSelect={(v) => select(open, v)}
              onClose={() => setOpen(null)}
              onWizard={nav.goWizard}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-4 px-4 pb-6">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Trip total</p>
          <p className="mt-1 text-2xl font-bold text-primary">$842</p>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["Day 1", "Day 2", "Day 3"].map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(i)}
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border text-xs font-semibold ${
                day === i ? "border-primary bg-primary text-white" : "border-border bg-surface"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {(
            [
              ["9:30 · Perot Museum", "12:30 · Nap", "2:30 · Indoor play"],
              ["10:00 · Pool", "1:00 · Lunch", "3:00 · Park"],
              ["9:00 · Easy morning", "11:30 · Brunch", "2:00 · Departure"],
            ] as const
          )[day]!.map((row) => (
            <div key={row} className="rounded-2xl border border-border bg-surface px-3 py-3 text-sm font-semibold">
              {row}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItineraryB({ nav }: { nav: Nav }) {
  const { chips, open, select, toggle, setOpen } = useChips();
  const [day, setDay] = useState(0);

  return (
    <div className="relative flex min-h-[36rem] flex-col bg-background text-ink">
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button type="button" onClick={nav.goHome} className="text-left">
              <h2 className="text-2xl font-bold">Dallas</h2>
            </button>
            <p className="mt-1 text-sm text-muted">Aug 24–27 · Family of 4</p>
          </div>
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
            Share
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-3 divide-x divide-y divide-border">
            {CHIP_META.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`px-2 py-2.5 text-left transition ${open === c.key ? "bg-primary-muted" : "bg-surface"}`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                <p className={`truncate text-xs font-semibold ${open === c.key ? "text-primary" : "text-ink"}`}>
                  {chips[c.key]}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto px-4 ${open ? "pb-52" : "pb-6"}`}>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">Estimated total</p>
          <p className="text-xl font-bold text-primary">$842</p>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["Day 1", "Day 2", "Day 3"].map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(i)}
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border text-xs font-semibold ${
                day === i ? "border-primary bg-primary text-white" : "border-border bg-surface"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {["9:30 · Perot Museum", "12:30 · Nap window", "2:30 · Indoor play"].map((row) => (
            <div key={row} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              {row}
            </div>
          ))}
        </div>
        <button type="button" onClick={nav.goWizard} className="mt-4 text-sm font-semibold text-primary underline">
          Edit in wizard
        </button>
      </div>
      {open ? (
        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-surface px-4 pb-5 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <button type="button" onClick={() => setOpen(null)} className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border" aria-label="Close" />
          <p className="text-sm font-semibold">Change {CHIP_META.find((c) => c.key === open)?.label.toLowerCase()}</p>
          <div className="mt-3">
            <ChipMenu
              chipKey={open}
              value={chips[open]}
              onSelect={(v) => select(open, v)}
              onClose={() => setOpen(null)}
              onWizard={nav.goWizard}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Your pick · B itinerary chrome, adults/kids heading, C-style inline chip menu */
function ItineraryPick({ nav }: { nav: Nav }) {
  const { chips, open, select, toggle, setOpen } = useChips();
  const [day, setDay] = useState(0);

  return (
    <div className="bg-background text-ink">
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button type="button" onClick={nav.goHome} className="text-left">
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
                <PinIcon />
                <span>Dallas</span>
              </h2>
            </button>
            <p className="mt-1 text-sm text-muted">Aug 24–27 · 2 adults · 2 kids</p>
          </div>
          <button type="button" className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
            Share
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-3 divide-x divide-y divide-border bg-background">
            {CHIP_META.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`px-2 py-2.5 text-left transition ${
                  open === c.key ? "bg-primary-muted" : "bg-surface hover:bg-background"
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                <p className={`truncate text-xs font-semibold ${open === c.key ? "text-primary" : "text-ink"}`}>
                  {chips[c.key]}
                </p>
              </button>
            ))}
          </div>
        </div>
        {open ? (
          <div className="mt-1.5">
            <ChipMenu
              chipKey={open}
              value={chips[open]}
              onSelect={(v) => select(open, v)}
              onClose={() => setOpen(null)}
              onWizard={nav.goWizard}
            />
          </div>
        ) : null}
      </div>
      <div className="px-4 pb-6">
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">Estimated total</p>
          <p className="text-xl font-bold text-primary">$842</p>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["Day 1", "Day 2", "Day 3"].map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(i)}
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border text-xs font-semibold transition ${
                day === i ? "border-primary bg-primary text-white shadow-soft" : "border-border bg-surface text-ink"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {(
            [
              ["9:30 · Perot Museum", "12:30 · Nap window", "2:30 · Indoor play"],
              ["10:00 · Pool", "1:00 · Lunch", "3:00 · Park"],
              ["9:00 · Easy morning", "11:30 · Brunch", "2:00 · Departure"],
            ] as const
          )[day]!.map((row) => (
            <div key={row} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink">
              {row}
            </div>
          ))}
        </div>
        <button type="button" onClick={nav.goWizard} className="mt-4 text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Edit in wizard
        </button>
      </div>
    </div>
  );
}

function ItineraryC({ nav }: { nav: Nav }) {
  const { chips, open, select, toggle, setOpen } = useChips();

  return (
    <div className="bg-background text-ink">
      <div className="px-4 pt-4">
        <button type="button" onClick={nav.goHome} className="text-left">
          <h2 className="text-xl font-bold">Dallas</h2>
        </button>
        <p className="text-xs text-muted">Aug 24–27 · 2 adults · 2 kids</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CHIP_META.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                open === c.key
                  ? "border-primary bg-primary-muted text-primary"
                  : "border-border bg-surface text-ink"
              }`}
            >
              {c.label} · {chips[c.key]}
            </button>
          ))}
        </div>
        {open ? (
          <div className="mt-2">
            <ChipMenu
              chipKey={open}
              value={chips[open]}
              onSelect={(v) => select(open, v)}
              onClose={() => setOpen(null)}
              onWizard={nav.goWizard}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-px border-y border-border bg-border">
        {[
          ["Activities", "$310"],
          ["Food", "$280"],
          ["Transit", "$252"],
        ].map(([l, v]) => (
          <div key={l} className="bg-surface px-2 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-muted">{l}</p>
            <p className="mt-0.5 text-sm font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 px-4 py-4">
        {["Day 1", "Day 2", "Day 3"].map((d) => (
          <button
            key={d}
            type="button"
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-left"
          >
            <p className="text-sm font-semibold">{d}</p>
            <p className="mt-0.5 text-xs text-muted">3 stops · nap midday</p>
          </button>
        ))}
        <button type="button" onClick={nav.goWizard} className="pt-1 text-sm font-semibold text-primary underline">
          Edit plan
        </button>
      </div>
    </div>
  );
}

function PhoneDemo({
  dir,
  screen,
  onScreenChange,
}: {
  dir: MobileDir;
  screen: LabScreen;
  onScreenChange?: (screen: LabScreen) => void;
}) {
  const [local, setLocal] = useState<LabScreen>(screen);

  // Controlled when parent passes onScreenChange; otherwise independent (compare columns).
  const active = onScreenChange ? screen : local;
  const setActive = onScreenChange ?? setLocal;

  const nav: Nav = {
    goHome: () => setActive("home"),
    goWizard: () => setActive("wizard"),
    goItinerary: () => setActive("itinerary"),
  };

  let body: ReactNode;
  if (active === "home") {
    body =
      dir === "pick" ? (
        <HomePick nav={nav} />
      ) : dir === "a" ? (
        <HomeA nav={nav} />
      ) : dir === "b" ? (
        <HomeB nav={nav} />
      ) : (
        <HomeC nav={nav} />
      );
  } else if (active === "wizard") {
    body = dir === "pick" || dir === "a" ? <WizardA nav={nav} /> : dir === "b" ? <WizardB nav={nav} /> : <WizardC nav={nav} />;
  } else {
    body =
      dir === "pick" ? (
        <ItineraryPick nav={nav} />
      ) : dir === "a" ? (
        <ItineraryA nav={nav} />
      ) : dir === "b" ? (
        <ItineraryB nav={nav} />
      ) : (
        <ItineraryC nav={nav} />
      );
  }

  return <PhoneFrame label={LAB_SCREENS.find((s) => s.id === active)?.label ?? active}>{body}</PhoneFrame>;
}

export function MobileOptionsPage() {
  const [dir, setDir] = useState<MobileDir>("pick");
  const [screen, setScreen] = useState<LabScreen>("home");
  const [compareAll, setCompareAll] = useState(false);
  const active = DIRECTIONS.find((d) => d.id === dir)!;

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="border-b border-border bg-surface px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium text-primary">Design Lab · Mobile</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Mobile UI directions</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Interactive phone previews. <span className="font-semibold text-ink">Your pick</span> combines the layouts
            you chose; A/B/C are the original explorations. Production web colors throughout.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDir(d.id);
                  setCompareAll(false);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !compareAll && dir === d.id
                    ? d.id === "pick"
                      ? "bg-accent text-white shadow-[var(--shadow-accent)]"
                      : "bg-primary text-white"
                    : "border border-border bg-surface text-ink hover:border-ink/40"
                }`}
              >
                {d.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCompareAll(true)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                compareAll
                  ? "bg-primary text-white"
                  : "border border-border bg-surface text-ink hover:border-ink/40"
              }`}
            >
              Compare A / B / C
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {LAB_SCREENS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  screen === item.id ? "bg-ink text-white" : "bg-background text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm text-muted">
            {!compareAll ? (
              <>
                <span className="font-semibold text-ink">{active.title}</span> — {active.summary}
              </>
            ) : (
              <>
                Same starting screen (
                <span className="font-semibold text-ink">{LAB_SCREENS.find((s) => s.id === screen)?.label}</span>
                ); navigate inside each phone independently.
              </>
            )}
          </p>

          <p className="mt-2 text-sm text-muted">
            <Link href="/" className="font-medium text-primary underline-offset-2 hover:underline">
              Open live homepage
            </Link>
            {" · "}
            production UI unchanged until you pick a mobile direction.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        {compareAll ? (
          <div className="grid gap-8 lg:grid-cols-3">
            {DIRECTIONS.filter((d) => d.id !== "pick").map((d) => (
              <div key={`${d.id}-${screen}`}>
                <p className="mb-3 text-center text-sm font-semibold text-primary">{d.title}</p>
                <PhoneDemo dir={d.id} screen={screen} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="mb-4 max-w-2xl text-center text-sm text-muted">{active.summary}</p>
            <PhoneDemo dir={dir} screen={screen} onScreenChange={setScreen} key={dir} />
            <p className="mt-4 max-w-md text-center text-xs text-muted">
              Tap Plan My Trip, wizard Next/Back, chip segments, and day tabs. Logo / title returns home.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
