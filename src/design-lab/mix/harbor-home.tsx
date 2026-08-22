"use client";

import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { BRAND } from "@/config/brand";
import Image from "next/image";
import Link from "next/link";
import { conceptPath } from "../concepts";

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

const ctaClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-accent)] transition hover:bg-accent-hover";

function FlowArrow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none flex shrink-0 items-center justify-center text-secondary ${className}`}
    >
      <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
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

function FlowDownArrow() {
  return (
    <div aria-hidden className="flex justify-center py-2 text-secondary sm:hidden">
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

export function HarborHome() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="border-b border-border px-6 py-16 sm:px-12 lg:border-b-0 lg:border-r lg:py-24">
          <FamilyTravelyLogo className="h-auto w-48" />
          <h1 className="mt-10 max-w-xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            Plan a family trip that actually works
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Personalized day-by-day itineraries built around your kids, your pace, and your budget without the hours of
            planning.
          </p>
          <Link href={conceptPath("harbor", "wizard")} className={`${ctaClassName} mt-8`}>
            Plan My Trip
          </Link>
          <p className="mt-3 text-sm text-muted">Start planning for free. No account needed.</p>
          <p className="sr-only">{BRAND.slogan}</p>
        </section>
        <aside className="relative min-h-[16rem] overflow-hidden sm:min-h-[20rem] lg:min-h-full">
          <Image
            src="/homepage-hero-family.jpg"
            alt="A family walking together through a sunny city square"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-[center_35%]"
          />
        </aside>
      </div>

      <section aria-labelledby="how-it-works-heading" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <h2
            id="how-it-works-heading"
            className="text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl"
          >
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-muted">
            Three steps from family details to a plan you can actually follow.
          </p>
          <ol className="mt-12 flex flex-col sm:flex-row sm:items-stretch sm:gap-0">
            {HOW_IT_WORKS.map((item, index) => (
              <li key={item.step} className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch">
                <div className="flex h-full w-full flex-col rounded-[1.75rem] border border-secondary/20 bg-secondary-muted/35 p-6 text-left sm:p-7">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted sm:text-base">{item.body}</p>
                </div>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <>
                    <FlowDownArrow />
                    <FlowArrow className="hidden w-8 sm:flex sm:self-center lg:w-10" />
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="why-familytravely-heading" className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <h2
            id="why-familytravely-heading"
            className="text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl"
          >
            Why {BRAND.name}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-muted">
            Most trip planners ignore how families actually move through a day. We plan for that from the start.
          </p>
          <ul className="mt-12 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {WHY_FAMILYTRAVELY.map((item) => (
              <li key={item.title} className="min-w-0">
                <div className="flex h-full flex-col rounded-[1.75rem] border border-secondary/20 bg-secondary-muted/35 p-6 text-left sm:p-7">
                  <span aria-hidden className="mb-5 block h-1 w-10 rounded-full bg-accent" />
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted sm:text-base">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-14 flex justify-center">
            <Link href={conceptPath("harbor", "wizard")} className={ctaClassName}>
              Plan My Trip
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
