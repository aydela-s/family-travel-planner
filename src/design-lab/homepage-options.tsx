"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { BRAND } from "@/config/brand";

type HomeConcept = "product" | "emotional" | "hybrid";

const CONCEPTS: {
  id: HomeConcept;
  title: string;
  summary: string;
}[] = [
  {
    id: "product",
    title: "1 · Product-first",
    summary:
      "Itinerary UI is the hero. Visitors see what FamilyTravely creates before they scroll — product clarity first.",
  },
  {
    id: "emotional",
    title: "2 · Emotional / family-first",
    summary:
      "Full-bleed family imagery and memory-led copy lead. Product proof comes after the emotional promise.",
  },
  {
    id: "hybrid",
    title: "3 · Hybrid",
    summary:
      "Family photo and product UI share the first viewport — emotional warmth with a tangible plan preview.",
  },
];

const CTA =
  "inline-flex items-center justify-center rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover";

const WHY_CARDS = [
  {
    title: "Built around your family",
    body: "Kids’ ages, nap times, energy levels, food needs, and interests shape your itinerary.",
  },
  {
    title: "Days that actually flow",
    body: "Activities, meals, travel time, and downtime are arranged into a realistic day — not just a list of places.",
  },
  {
    title: "Your pace, not a checklist",
    body: "Choose how much you want to do each day and leave room to breathe.",
  },
  {
    title: "A budget that actually matters",
    body: "Your budget influences what we recommend, from activities to meals.",
  },
] as const;

const HOW_STEPS = [
  {
    step: "01",
    title: "Tell us about your family",
    body: "Kids’ ages, interests, pace, food needs, transportation, budget, and more.",
  },
  {
    step: "02",
    title: "Get your personalized plan",
    body: "We build your days around what your family actually needs.",
  },
  {
    step: "03",
    title: "Review and go",
    body: "Give it a quick scan, make any changes, then share your plan and take it with you.",
  },
] as const;

const DAY_FLOW = [
  { time: "8:00 AM", title: "Breakfast", kind: "meal" as const },
  { time: "9:30 AM", title: "Water park", kind: "activity" as const, travel: "20 min" },
  { time: "12:15 PM", title: "Lunch & nap", kind: "meal" as const, travel: "15 min" },
  { time: "3:30 PM", title: "Playground", kind: "activity" as const, travel: "12 min" },
  { time: "6:00 PM", title: "Dinner", kind: "meal" as const, travel: "18 min" },
];

const SIGNAL_CHIPS = [
  { label: "Kids’ ages", emoji: "👧" },
  { label: "Nap times", emoji: "😴" },
  { label: "Food needs", emoji: "🍽️" },
  { label: "Transportation", emoji: "🚗" },
  { label: "Budget", emoji: "💰" },
] as const;

function PlanCta({ className = "" }: { className?: string }) {
  return (
    <Link href="/plan" className={`${CTA} ${className}`}>
      Plan My Trip
    </Link>
  );
}

function Reassurance({ className = "", pill = false }: { className?: string; pill?: boolean }) {
  if (pill) {
    return (
      <p className={`text-xs font-semibold text-primary ${className}`}>
        <span className="inline-block rounded-full bg-accent-muted px-3 py-1">Free to start · No account needed</span>
      </p>
    );
  }
  return <p className={`text-sm text-muted ${className}`}>Start planning for free. No account needed.</p>;
}

function PlanCtaOutline({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/plan"
      className={`inline-flex items-center justify-center rounded-full border-2 border-primary bg-white px-8 py-3.5 text-base font-semibold text-primary transition hover:bg-primary-muted ${className}`}
    >
      Plan My Trip
    </Link>
  );
}

function SignalChips({ dark = false }: { dark?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {SIGNAL_CHIPS.map((chip) => (
        <li
          key={chip.label}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            dark
              ? "bg-white/15 text-white backdrop-blur"
              : "border border-border bg-surface text-ink"
          }`}
        >
          <span aria-hidden>{chip.emoji}</span>
          {chip.label}
        </li>
      ))}
    </ul>
  );
}

/** Realistic itinerary UI mock — used as product hero / proof. */
function ItineraryMock({ compact = false, snapshot = false }: { compact?: boolean; snapshot?: boolean }) {
  const items = snapshot ? DAY_FLOW.slice(0, 3) : DAY_FLOW;

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-[var(--shadow-card)] ${
        snapshot
          ? "shadow-lg ring-1 ring-primary/15"
          : compact
            ? ""
            : "ring-1 ring-primary/10 shadow-lg"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-ink sm:text-xl">
            <span className="inline-flex h-5 w-5 items-center justify-center text-primary" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M12 21s7-4.8 7-10.5a7 7 0 1 0-14 0C5 16.2 12 21 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="10.5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            </span>
            Dallas
          </p>
          <p className="mt-0.5 text-xs text-muted sm:text-sm">Aug 24–27 · 2 adults · 2 kids</p>
        </div>
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Day 1
        </span>
      </div>

      <div className="border-b border-border bg-background px-4 py-2.5 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Balanced · Comfortable</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">Water park & playground day</p>
      </div>

      <ol className={`space-y-0 ${compact && !snapshot ? "max-h-[22rem] overflow-y-auto" : ""}`}>
        {items.map((item, i) => (
          <li key={item.time} className="relative">
            {item.travel ? (
              <div className="flex items-center gap-2 border-b border-border/60 bg-background/80 px-4 py-1.5 text-[11px] text-muted sm:px-5">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span>{item.travel} travel</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
            ) : null}
            <div className="flex gap-3 px-4 py-3 sm:px-5">
              <div className="flex w-16 shrink-0 flex-col items-start pt-0.5">
                <span className="text-[11px] font-semibold tabular-nums text-muted">{item.time}</span>
              </div>
              <div
                className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  item.kind === "meal"
                    ? "bg-accent"
                    : item.kind === "rest"
                      ? "bg-secondary"
                      : "bg-primary"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-xs capitalize text-muted">{item.kind}</p>
              </div>
            </div>
            {i < items.length - 1 && !items[i + 1]?.travel ? (
              <div className="ml-[5.25rem] h-px bg-border/70 sm:ml-[5.75rem]" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DayFlowStrip() {
  return (
    <div className="flex w-full justify-center">
      <ol className="inline-flex origin-center scale-[0.92] flex-nowrap items-center sm:scale-[0.96] lg:scale-100">
        {DAY_FLOW.map((item, i) => (
          <li key={item.time} className="flex shrink-0 items-center">
            <div className="flex items-center whitespace-nowrap rounded-xl border border-primary/15 bg-white px-3 py-2.5 shadow-sm sm:px-3.5 sm:py-3">
              <span className="text-[11px] font-semibold tabular-nums text-muted sm:text-xs">
                {item.time.replace(/\s*(AM|PM)/i, "")}
              </span>
              <span className="text-muted/50" aria-hidden>
                ·
              </span>
              <span className="text-xs font-semibold text-ink sm:text-sm">{item.title}</span>
            </div>
            {i < DAY_FLOW.length - 1 ? (
              <span aria-hidden className="shrink-0 px-1.5 text-base text-secondary sm:px-2">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function WhySection({
  heading = "Spend less time figuring it all out.",
  intro = "Family travel comes with enough to think about. FamilyTravely handles the details so you can focus on enjoying the trip together.",
  columns = 2,
  introFullWidth = false,
  cards = WHY_CARDS,
  productCards = false,
}: {
  heading?: string;
  intro?: string;
  columns?: 2 | 4;
  introFullWidth?: boolean;
  cards?: readonly { title: string; body: string }[];
  productCards?: boolean;
}) {
  return (
    <section className={`border-t border-border ${productCards ? "bg-background" : "bg-surface"}`}>
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{heading}</h2>
        <p
          className={`mt-3 text-base leading-relaxed text-muted ${introFullWidth ? "max-w-none" : "max-w-2xl"}`}
        >
          {intro}
        </p>
        <ul
          className={`mt-10 grid gap-4 ${
            columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"
          }`}
        >
          {cards.map((card) => (
            <li
              key={card.title}
              className={
                productCards
                  ? "rounded-[1.5rem] border border-primary/25 bg-white p-5 text-left shadow-sm sm:p-6"
                  : "rounded-[1.5rem] border border-secondary/20 bg-secondary-muted/35 p-5 text-left sm:p-6"
              }
            >
              <span aria-hidden className="mb-4 block h-1 w-8 rounded-full bg-accent" />
              <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StepFlowArrow({ layout = "horizontal" }: { layout?: "horizontal" | "vertical" }) {
  if (layout === "vertical") {
    return (
      <div aria-hidden className="flex justify-center py-0.5 text-secondary">
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
          <path
            d="M6 0v16M1.5 12 6 18.5 10.5 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center px-1 text-secondary sm:px-2">
      <svg width="24" height="12" viewBox="0 0 28 12" fill="none">
        <path
          d="M0 6h22M18 1.5 24.5 6 18 10.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function HowSection({
  steps = HOW_STEPS,
  circledSteps = false,
  productCards = false,
}: {
  steps?: readonly { step: string; title: string; body: string }[];
  circledSteps?: boolean;
  productCards?: boolean;
}) {
  return (
    <section
      className={`border-t border-border ${productCards ? "bg-primary-muted/35" : "bg-background"}`}
    >
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
          From family details to a trip you can actually follow.
        </h2>
        <ol
          className={
            productCards
              ? "mt-12 flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-x-2"
              : "mt-12 grid gap-6 sm:grid-cols-3 sm:gap-5"
          }
        >
          {steps.flatMap((step, i) => {
            const card = (
              <li
                key={step.step}
                className={
                  productCards
                    ? "flex h-full w-full flex-col rounded-[1.5rem] border border-border/70 bg-white p-6 text-left shadow-sm"
                    : "rounded-[1.5rem] border border-secondary/20 bg-secondary-muted/35 p-6 text-left"
                }
              >
                {circledSteps ? (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-muted text-sm font-bold tabular-nums text-primary">
                    {step.step}
                  </span>
                ) : (
                  <span className="text-sm font-bold tabular-nums text-primary">{step.step}</span>
                )}
                <h3 className={`text-lg font-semibold tracking-tight text-ink ${circledSteps ? "mt-4" : "mt-3"}`}>
                  {step.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            );

            if (!productCards || i === steps.length - 1) return [card];

            return [
              card,
              <li
                key={`${step.step}-arrow`}
                aria-hidden
                className="list-none flex items-center justify-center py-0.5 sm:px-1 sm:py-0"
              >
                <span className="sm:hidden">
                  <StepFlowArrow layout="vertical" />
                </span>
                <span className="hidden sm:inline-flex">
                  <StepFlowArrow layout="horizontal" />
                </span>
              </li>,
            ];
          })}
        </ol>
      </div>
    </section>
  );
}

function FinalCta({ subtitleOneLine = false }: { subtitleOneLine?: boolean }) {
  return (
    <section className="border-t border-border bg-primary">
      <div
        className={`mx-auto flex flex-col items-center px-6 py-16 text-center sm:py-20 ${
          subtitleOneLine ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Make the memories. We’ll handle the details.
        </h2>
        <p
          className={`mt-3 text-base leading-relaxed text-white/80 ${
            subtitleOneLine ? "max-w-none text-pretty sm:whitespace-nowrap" : "max-w-md"
          }`}
        >
          Your family trip shouldn’t feel like another project to manage.
        </p>
        <Link
          href="/plan"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover"
        >
          Plan My Trip →
        </Link>
        <p className="mt-3 text-sm text-white/70">Free to start · No account needed</p>
      </div>
    </section>
  );
}

function ProductSection({
  layout = "side",
  copyFullWidth = false,
  tealBand = false,
}: {
  layout?: "side" | "stack" | "timeline";
  copyFullWidth?: boolean;
  tealBand?: boolean;
}) {
  const copy = (
    <div className="min-w-0">
      <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
        Not just a list of places. A plan for your day.
      </h2>
      <p
        className={`mt-4 text-base leading-relaxed text-muted ${copyFullWidth ? "max-w-none" : "max-w-lg"}`}
      >
        FamilyTravely considers the whole day — including opening hours, travel time, meals, naps, and your family’s
        energy — so your itinerary makes sense from morning to bedtime.
      </p>
    </div>
  );

  if (layout === "timeline") {
    return (
      <section
        className={`border-t ${tealBand ? "border-primary/10 bg-primary-muted/45" : "border-border bg-background"}`}
      >
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
          {copy}
          <div className="mt-10">
            <DayFlowStrip />
          </div>
        </div>
      </section>
    );
  }

  if (layout === "stack") {
    return (
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-20">
          <div className="text-center">{copy}</div>
          <div className="mx-auto mt-10 max-w-md">
            <ItineraryMock compact />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-2">
        {copy}
        <ItineraryMock compact />
      </div>
    </section>
  );
}

/* ─── Concept 1: Product-first ─── */

const PRODUCT_WHY_CARDS = WHY_CARDS.map((card) =>
  card.title === "Days that actually flow"
    ? {
        ...card,
        body: "Activities, meals, travel time, and downtime are arranged into a realistic day, not just a list of places.",
      }
    : card,
);

const PRODUCT_HOW_STEPS = [
  { step: "1", title: HOW_STEPS[0]!.title, body: HOW_STEPS[0]!.body },
  { step: "2", title: HOW_STEPS[1]!.title, body: HOW_STEPS[1]!.body },
  {
    step: "3",
    title: "Share and go",
    body: "Your itinerary is ready. Share it with your family or take it with you wherever you go.",
  },
] as const;

const HERO_HEADLINE = "Plan a family trip that actually works";
const HERO_TAGLINE = "Spend less time planning. More time making memories.";
const HERO_BODY =
  "Personalized day-by-day itineraries built around your kids, your pace, and your budget.";

type ProductMobileDir = "a" | "b" | "c";

const PRODUCT_MOBILE_DIRECTIONS: {
  id: ProductMobileDir;
  title: string;
  summary: string;
}[] = [
  {
    id: "a",
    title: "A · Clean stack",
    summary:
      "Headline and italic line, itinerary preview card, body + CTA — then compact how and two why cards on teal. Coral only on buttons.",
  },
  {
    id: "b",
    title: "B · Framed photo",
    summary:
      "Same hero order with the photo in a rounded frame on light teal. How-only below — tightest scroll.",
  },
  {
    id: "c",
    title: "C · Teal band + sticky",
    summary:
      "Photo between copy blocks; body and CTA sit on a primary-muted band. Compact how below plus sticky Plan My Trip.",
  },
];

function MobileHeroTitles() {
  return (
    <>
      <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-primary">{HERO_HEADLINE}</h1>
      <p className="mt-3 text-base font-medium italic leading-snug text-ink">{HERO_TAGLINE}</p>
    </>
  );
}

function MobileHeroCtaBlock({ reassurance = true }: { reassurance?: boolean }) {
  return (
    <>
      <p className="text-sm leading-relaxed text-muted">{HERO_BODY}</p>
      <PlanCta className="mt-4 w-full" />
      {reassurance ? <Reassurance className="mt-2" /> : null}
    </>
  );
}

function MobileFamilyImage({
  className = "h-44",
  rounded = false,
}: {
  className?: string;
  rounded?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden ${rounded ? "rounded-2xl" : ""} ${className}`}>
      <Image
        src="/homepage-hero-family.jpg"
        alt="A family walking together through a sunny city square"
        fill
        sizes="22rem"
        className="object-cover object-[center_35%]"
      />
    </div>
  );
}

const MOBILE_WHY_PICK = PRODUCT_WHY_CARDS.slice(0, 2);

function MobileHowCompact({ variant = "default" }: { variant?: "default" | "teal" }) {
  return (
    <section
      className={`border-t border-border px-4 py-6 ${
        variant === "teal" ? "bg-primary-muted/50" : "bg-accent-muted/40"
      }`}
    >
      <h2 className="text-base font-semibold tracking-tight text-primary">How it works</h2>
      <ol className="mt-3 flex flex-col">
        {PRODUCT_HOW_STEPS.flatMap((step, i) => {
          const card = (
            <li key={step.step} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-border/60">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                  variant === "teal" ? "bg-primary-muted text-primary" : "bg-accent text-white"
                }`}
              >
                {step.step}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          );

          if (i === PRODUCT_HOW_STEPS.length - 1) return [card];

          return [
            card,
            <li key={`${step.step}-arrow`} aria-hidden className="list-none">
              <StepFlowArrow layout="vertical" />
            </li>,
          ];
        })}
      </ol>
    </section>
  );
}

function MobileWhyCompact({ variant = "default" }: { variant?: "default" | "teal" }) {
  return (
    <section
      className={`border-t border-border px-4 py-6 ${
        variant === "teal" ? "bg-background" : "bg-primary-muted/50"
      }`}
    >
      <h2 className="text-base font-semibold tracking-tight text-primary">Why FamilyTravely</h2>
      <ul className="mt-3 space-y-2.5">
        {MOBILE_WHY_PICK.map((card) => (
          <li key={card.title} className="rounded-xl border border-primary/25 bg-white p-3">
            <span aria-hidden className="mb-1.5 block h-1 w-6 rounded-full bg-accent" />
            <h3 className="text-sm font-semibold text-ink">{card.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{card.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MobileItineraryHero() {
  return (
    <section className="relative px-3 pb-2 pt-1">
      <div
        aria-hidden
        className="absolute inset-x-2 top-2 bottom-2 rounded-[1.25rem] bg-gradient-to-br from-primary-muted via-secondary-muted/80 to-primary-muted/40"
      />
      <div className="relative">
        <ItineraryMock snapshot />
      </div>
    </section>
  );
}

function MobileBottomCta({ outline = false }: { outline?: boolean }) {
  return (
    <section className="border-t border-border bg-background px-4 py-6">
      {outline ? <PlanCtaOutline className="w-full" /> : <PlanCta className="w-full" />}
    </section>
  );
}

function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="w-[min(100%,22rem)] overflow-hidden rounded-[1.75rem] border-[3px] border-ink/80 bg-background shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-center bg-ink/90 py-1.5">
          <span className="h-1 w-16 rounded-full bg-white/30" aria-hidden />
        </div>
        <div className="relative h-[38rem] overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

function HomeProductMobileA() {
  return (
    <div className="lab-font-jakarta bg-gradient-to-b from-primary-muted/70 via-white to-background text-ink">
      <section className="px-4 pb-4 pt-5">
        <FamilyTravelyLogo className="h-auto w-32" />
        <div className="mt-5">
          <MobileHeroTitles />
        </div>
      </section>

      <MobileItineraryHero />

      <section className="px-4 py-5">
        <MobileHeroCtaBlock reassurance={false} />
        <Reassurance pill className="mt-3" />
      </section>

      <MobileHowCompact variant="teal" />
      <MobileWhyCompact variant="teal" />
      <MobileBottomCta outline />
      <p className="sr-only">{BRAND.slogan}</p>
    </div>
  );
}

function HomeProductMobileB() {
  return (
    <div className="lab-font-jakarta bg-background text-ink">
      <section className="px-4 pb-4 pt-5">
        <FamilyTravelyLogo className="h-auto w-32" />
        <div className="mt-5">
          <MobileHeroTitles />
        </div>
      </section>

      <section className="bg-primary-muted/45 px-4 py-4">
        <MobileFamilyImage className="h-40" rounded />
      </section>

      <section className="px-4 py-5">
        <MobileHeroCtaBlock />
      </section>

      <MobileHowCompact />
      <MobileBottomCta />
      <p className="sr-only">{BRAND.slogan}</p>
    </div>
  );
}

function HomeProductMobileC() {
  return (
    <div className="lab-font-jakarta bg-background pb-20 text-ink">
      <section className="px-4 pb-4 pt-5">
        <FamilyTravelyLogo className="h-auto w-32" />
        <div className="mt-5">
          <MobileHeroTitles />
        </div>
      </section>

      <MobileFamilyImage className="h-40" />

      <section className="bg-primary-muted/55 px-4 py-5">
        <MobileHeroCtaBlock reassurance={false} />
        <p className="mt-2 text-xs text-muted">Start planning for free. No account needed.</p>
      </section>

      <MobileHowCompact />
      <MobileWhyCompact />

      <div className="sticky bottom-0 z-20 border-t border-primary/15 bg-surface/95 px-4 py-3 backdrop-blur-sm">
        <PlanCta className="w-full" />
      </div>

      <p className="sr-only">{BRAND.slogan}</p>
    </div>
  );
}

function renderProductMobile(dir: ProductMobileDir) {
  if (dir === "a") return <HomeProductMobileA />;
  if (dir === "b") return <HomeProductMobileB />;
  return <HomeProductMobileC />;
}

function HomeProduct() {
  return (
    <div className="lab-font-jakarta min-h-screen bg-gradient-to-b from-primary-muted/45 via-background to-background text-ink">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12 lg:py-16">
        <section>
          <FamilyTravelyLogo className="h-auto w-44" />
          <h1 className="mt-8 max-w-xl text-3xl font-semibold tracking-tight text-primary sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            {HERO_HEADLINE}
          </h1>
          <p className="mt-4 text-lg font-medium italic leading-snug text-ink sm:text-xl">
            {HERO_TAGLINE}
          </p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
            {HERO_BODY}
          </p>
          <div className="mt-8">
            <PlanCta />
          </div>
          <Reassurance pill className="mt-3" />
        </section>

        <aside className="relative">
          <div
            aria-hidden
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary-muted via-secondary-muted/70 to-primary-muted/50 sm:-inset-6"
          />
          <div className="relative">
            <ItineraryMock />
          </div>
        </aside>
      </div>

      <WhySection columns={2} introFullWidth cards={PRODUCT_WHY_CARDS} productCards />
      <ProductSection layout="timeline" copyFullWidth tealBand />
      <HowSection steps={PRODUCT_HOW_STEPS} circledSteps productCards />
      <FinalCta subtitleOneLine />
      <p className="sr-only">{BRAND.slogan}</p>
    </div>
  );
}

/* ─── Concept 2: Emotional / family-first ─── */

function HomeEmotional() {
  return (
    <div className="lab-font-jakarta min-h-screen bg-background text-ink">
      <section className="relative min-h-[min(92vh,52rem)] overflow-hidden">
        <Image
          src="/homepage-hero-family.jpg"
          alt="A family walking together through a sunny city square"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/20"
        />
        <div className="relative z-10 mx-auto flex min-h-[min(92vh,52rem)] max-w-4xl flex-col justify-end px-6 pb-14 pt-10 sm:px-10 sm:pb-20">
          <FamilyTravelyLogo className="h-auto w-40 brightness-0 invert" />
          <h1 className="mt-8 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Plan a family trip that actually works
          </h1>
          <p className="mt-4 max-w-xl text-xl font-medium italic leading-snug text-white/95 sm:text-2xl">
            Spend less time planning. More time making memories.
          </p>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/80">
            Personalized day-by-day itineraries built around your kids, your pace, and your budget.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PlanCta />
            <p className="text-sm text-white/75">Start planning for free. No account needed.</p>
          </div>
          <div className="mt-8">
            <SignalChips dark />
          </div>
        </div>
      </section>

      <ProductSection layout="timeline" />
      <WhySection
        heading="Spend less time figuring it all out."
        columns={4}
      />
      <HowSection />
      <FinalCta />
      <p className="sr-only">{BRAND.slogan}</p>
    </div>
  );
}

/* ─── Concept 3: Hybrid ─── */

function HomeHybrid() {
  return (
    <div className="lab-font-jakarta min-h-screen bg-background text-ink">
      <div className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <section className="relative z-10 flex flex-col justify-center px-6 py-14 sm:px-10 lg:py-20">
            <FamilyTravelyLogo className="h-auto w-44" />
            <h1 className="mt-8 max-w-lg text-3xl font-semibold tracking-tight text-primary sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
              Plan a family trip that actually works
            </h1>
            <p className="mt-4 text-lg font-medium italic leading-snug text-ink sm:text-xl">
              Spend less time planning. More time making memories.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
              Personalized day-by-day itineraries built around your kids, your pace, and your budget.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <PlanCta />
            </div>
            <Reassurance className="mt-3" />
          </section>

          <aside className="relative min-h-[18rem] lg:min-h-[36rem]">
            <Image
              src="/homepage-hero-family.jpg"
              alt="A family walking together through a sunny city square"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[center_35%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent lg:bg-gradient-to-l lg:from-transparent lg:via-transparent lg:to-background/40"
            />
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6 lg:inset-x-auto lg:bottom-8 lg:left-6 lg:right-8 lg:top-auto">
              <div className="max-w-md lg:ml-0">
                <ItineraryMock compact />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="border-b border-border bg-surface px-6 py-5 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <SignalChips />
        </div>
      </div>

      <WhySection columns={2} />
      <ProductSection layout="side" />
      <HowSection />
      <FinalCta />
      <p className="sr-only">{BRAND.slogan}</p>
    </div>
  );
}

function ConceptFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-card)]">
      <p className="border-b border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
        {label}
      </p>
      <div className="max-h-[70vh] overflow-y-auto">{children}</div>
    </div>
  );
}

export function HomepageOptionsPage() {
  const [concept, setConcept] = useState<HomeConcept>("product");
  const [compareAll, setCompareAll] = useState(false);
  const [productView, setProductView] = useState<"desktop" | "mobile">("desktop");
  const [mobileDir, setMobileDir] = useState<ProductMobileDir>("a");
  const [compareMobile, setCompareMobile] = useState(false);
  const active = CONCEPTS.find((c) => c.id === concept)!;
  const activeMobile = PRODUCT_MOBILE_DIRECTIONS.find((d) => d.id === mobileDir)!;

  let body: ReactNode = null;
  if (concept === "product") {
    if (productView === "mobile") {
      if (compareMobile) {
        body = (
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-3">
            {PRODUCT_MOBILE_DIRECTIONS.map((d) => (
              <PhoneFrame key={d.id} label={d.title}>
                {renderProductMobile(d.id)}
              </PhoneFrame>
            ))}
          </div>
        );
      } else {
        body = (
          <div className="flex flex-col items-center px-4 py-8 sm:px-8">
            <p className="mb-4 max-w-xl text-center text-sm text-muted">{activeMobile.summary}</p>
            <PhoneFrame label={activeMobile.title}>{renderProductMobile(mobileDir)}</PhoneFrame>
            <p className="mt-4 max-w-md text-center text-xs text-muted">
              Scroll inside the phone preview. All three use headline → italic → photo → body + CTA; compact sections
              below differ.
            </p>
          </div>
        );
      }
    } else {
      body = <HomeProduct />;
    }
  } else if (concept === "emotional") {
    body = <HomeEmotional />;
  } else {
    body = <HomeHybrid />;
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="border-b border-border bg-surface px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium text-primary">Design Lab · Homepage</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Homepage directions</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Three distinct landing concepts for FamilyTravely. Production homepage is untouched — explore here only.
            Brand colors, logo, and Plus Jakarta Sans throughout.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {CONCEPTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setConcept(c.id);
                  setCompareAll(false);
                  if (c.id !== "product") {
                    setProductView("desktop");
                    setCompareMobile(false);
                  }
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !compareAll && concept === c.id
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-ink hover:border-ink/40"
                }`}
              >
                {c.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCompareAll(true)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                compareAll
                  ? "bg-accent text-white shadow-[var(--shadow-accent)]"
                  : "border border-border bg-surface text-ink hover:border-ink/40"
              }`}
            >
              Compare all three
            </button>
          </div>

          {concept === "product" && !compareAll ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setProductView("desktop");
                  setCompareMobile(false);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  productView === "desktop"
                    ? "bg-ink text-white"
                    : "border border-border bg-surface text-ink hover:border-ink/40"
                }`}
              >
                Desktop
              </button>
              {PRODUCT_MOBILE_DIRECTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setProductView("mobile");
                    setMobileDir(d.id);
                    setCompareMobile(false);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    productView === "mobile" && !compareMobile && mobileDir === d.id
                      ? "bg-primary text-white"
                      : "border border-border bg-surface text-ink hover:border-ink/40"
                  }`}
                >
                  Mobile {d.id.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setProductView("mobile");
                  setCompareMobile(true);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  productView === "mobile" && compareMobile
                    ? "bg-accent text-white shadow-[var(--shadow-accent)]"
                    : "border border-border bg-surface text-ink hover:border-ink/40"
                }`}
              >
                Compare mobile A / B / C
              </button>
            </div>
          ) : null}

          <p className="mt-4 text-sm text-muted">
            {!compareAll ? (
              <>
                <span className="font-semibold text-ink">{active.title}</span> — {active.summary}
                {concept === "product" && productView === "mobile" ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-semibold text-ink">
                      {compareMobile ? "Mobile compare" : activeMobile.title}
                    </span>
                    {!compareMobile ? <> — {activeMobile.summary}</> : null}
                  </>
                ) : null}
              </>
            ) : (
              <>Scroll each column independently. Same brand system; different hero hierarchy.</>
            )}
          </p>

          <p className="mt-2 text-sm text-muted">
            <Link href="/" className="font-medium text-primary underline-offset-2 hover:underline">
              Open live homepage
            </Link>
            {" · "}
            production UI unchanged.
          </p>
        </div>
      </div>

      {compareAll ? (
        <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-8 sm:px-8 lg:grid-cols-3">
          <ConceptFrame label="1 · Product-first">
            <HomeProduct />
          </ConceptFrame>
          <ConceptFrame label="2 · Emotional">
            <HomeEmotional />
          </ConceptFrame>
          <ConceptFrame label="3 · Hybrid">
            <HomeHybrid />
          </ConceptFrame>
        </div>
      ) : (
        <div key={concept}>{body}</div>
      )}
    </div>
  );
}
