import Link from "next/link";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Tell us about your family",
    body: "Kids’ ages, travel pace, food needs, and budget style — the details that actually change a day.",
  },
  {
    step: "2",
    title: "Get a day-by-day plan",
    body: "Activities, meals, and downtime sequenced for real family energy — not a packed tourist checklist.",
  },
  {
    step: "3",
    title: "Review and go",
    body: "Tweak what you need, then share or take the itinerary with you.",
  },
] as const;

const WHY_TRIPNESTLY = [
  {
    title: "Built around your kids",
    body: "Ages, naps, and energy levels shape what we schedule — so the plan survives the afternoon.",
  },
  {
    title: "Your pace, not a checklist",
    body: "We leave room to breathe between stops instead of stacking every landmark into one day.",
  },
  {
    title: "Budget style that means something",
    body: "Save, balanced, or splurge changes the kinds of activities and meals we pick — not a fake dollar target.",
  },
] as const;

const ctaClassName =
  "inline-flex items-center justify-center rounded-2xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const tileClassName =
  "flex h-full flex-col rounded-3xl border border-border bg-surface p-6 text-left shadow-[var(--shadow-card)] sm:p-7";

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

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(1,109,118,0.08),transparent_50%),radial-gradient(ellipse_at_90%_5%,rgba(2,187,203,0.10),transparent_45%),radial-gradient(ellipse_at_50%_100%,rgba(255,87,87,0.06),transparent_50%)]"
      />

      <section className="relative mx-auto flex min-h-[88svh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="animate-fade-in">
          <TripNestlyLogo className="mx-auto h-auto w-[min(100%,22rem)] sm:w-[26rem]" />
        </div>

        <h1 className="animate-fade-in mt-8 max-w-2xl text-3xl font-semibold tracking-tight text-primary sm:text-4xl [animation-delay:120ms]">
          Plan a family trip that actually works
        </h1>

        <p className="animate-fade-in mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg [animation-delay:220ms]">
          Personalized itineraries built around your kids, your pace, and your budget.
        </p>

        <Link
          href="/plan"
          className={`animate-fade-in mt-8 ${ctaClassName} [animation-delay:320ms]`}
        >
          Plan my trip
        </Link>

        <p className="animate-fade-in mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base [animation-delay:400ms]">
          No more hours researching activities, meals, and schedules. Get a
          family-friendly itinerary in minutes.
        </p>

        <p className="sr-only">{BRAND.slogan}</p>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="relative border-t border-border/70 bg-surface/70"
      >
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
              <li
                key={item.step}
                className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch"
              >
                <div className={`${tileClassName} w-full`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted sm:text-base">
                    {item.body}
                  </p>
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

      <section
        aria-labelledby="why-tripnestly-heading"
        className="relative border-t border-border/70"
      >
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <h2
            id="why-tripnestly-heading"
            className="text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl"
          >
            Why {BRAND.name}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-muted">
            Most trip planners ignore how families actually move through a day.
            We plan for that from the start.
          </p>

          <ul className="mt-12 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {WHY_TRIPNESTLY.map((item) => (
              <li key={item.title} className="min-w-0">
                <div className="flex h-full flex-col rounded-3xl border border-border bg-surface p-6 text-left shadow-[var(--shadow-card)] sm:p-7">
                  <span
                    aria-hidden
                    className="mb-5 block h-1 w-10 rounded-full bg-accent"
                  />
                  <h3 className="text-lg font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted sm:text-base">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex justify-center">
            <Link href="/plan" className={ctaClassName}>
              Plan my trip
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
