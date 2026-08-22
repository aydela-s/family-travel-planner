import BackToTopButton from "@/components/BackToTopButton";
import PlanMyTripLink from "@/components/PlanMyTripLink";
import PrefetchPlan from "@/components/PrefetchPlan";
import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { BRAND } from "@/config/brand";
import Image from "next/image";

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

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-ink">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="border-b border-border px-6 py-10 sm:px-12 lg:border-b-0 lg:border-r lg:py-24">
          <FamilyTravelyLogo className="h-auto w-36 lg:w-48" />
          <h1 className="mt-6 max-w-xl text-[1.65rem] font-semibold leading-tight tracking-tight text-primary lg:mt-10 lg:text-5xl">
            Plan a family trip that actually works
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted lg:mt-5 lg:text-lg">
            Personalized day-by-day itineraries built around your kids, your pace, and your budget without the hours of
            planning.
          </p>
          <PlanMyTripLink className="mt-8" />
          <p className="mt-3 text-sm text-muted">Start planning for free. No account needed.</p>
          <p className="sr-only">{BRAND.slogan}</p>
        </section>
        <aside className="relative min-h-[16rem] overflow-hidden sm:min-h-[20rem] lg:min-h-full">
          <Image
            src="/homepage-hero-family.jpg"
            alt="A family walking together through a sunny city square"
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-[center_35%]"
          />
        </aside>
      </div>

      <section aria-labelledby="how-it-works-heading" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:px-12 lg:py-20">
          <h2
            id="how-it-works-heading"
            className="text-lg font-semibold tracking-tight text-primary lg:text-center lg:text-3xl"
          >
            How it works
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted lg:mx-auto lg:mt-3 lg:text-center lg:text-base">
            Three steps from family details to a plan you can actually follow.
          </p>
          <ol className="mt-4 space-y-3 lg:mt-12 lg:flex lg:flex-row lg:items-stretch lg:space-y-0">
            {HOW_IT_WORKS.map((item, index) => (
              <li key={item.step} className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-stretch">
                <div className="flex h-full w-full gap-3 rounded-[1.25rem] border border-secondary/20 bg-secondary-muted/35 p-4 text-left lg:flex-col lg:rounded-[1.75rem] lg:p-7">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white lg:h-9 lg:w-9 lg:text-sm">
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight text-ink lg:mt-4 lg:text-lg">{item.title}</h3>
                    <p className="mt-0.5 flex-1 text-xs leading-relaxed text-muted lg:mt-2 lg:text-base">{item.body}</p>
                  </div>
                </div>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <FlowArrow className="hidden w-8 lg:flex lg:self-center lg:w-10" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="why-familytravely-heading" className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:px-12 lg:py-20">
          <h2
            id="why-familytravely-heading"
            className="text-lg font-semibold tracking-tight text-primary lg:text-center lg:text-3xl"
          >
            Why {BRAND.name}
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted lg:mx-auto lg:mt-3 lg:text-center lg:text-base">
            Most trip planners ignore how families actually move through a day. We plan for that from the start.
          </p>
          <ul className="mt-4 space-y-3 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
            {WHY_FAMILYTRAVELY.map((item) => (
              <li key={item.title} className="min-w-0">
                <div className="flex h-full flex-col rounded-[1.25rem] border border-secondary/20 bg-secondary-muted/35 p-4 text-left lg:rounded-[1.75rem] lg:p-7">
                  <span aria-hidden className="mb-2 block h-1 w-7 rounded-full bg-accent lg:mb-5 lg:w-10" />
                  <h3 className="text-sm font-semibold tracking-tight text-ink lg:text-lg">{item.title}</h3>
                  <p className="mt-0.5 flex-1 text-xs leading-relaxed text-muted lg:mt-2 lg:text-base">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center lg:mt-14">
            <PlanMyTripLink />
          </div>
        </div>
      </section>

      <PrefetchPlan />
      <BackToTopButton />
    </main>
  );
}
