import PlanMyTripLink from "@/components/PlanMyTripLink";
import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import {
  DAY_FLOW,
  HERO_BODY,
  HERO_HEADLINE,
  HERO_TAGLINE,
  MOBILE_WHY_PICK,
  PRODUCT_HOW_STEPS,
  PRODUCT_WHY_CARDS,
} from "@/components/homepage/content";
import { BRAND } from "@/config/brand";

function ReassurancePill({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs font-semibold text-primary ${className}`}>
      <span className="inline-block rounded-full bg-accent-muted px-3 py-1">Free to start · No account needed</span>
    </p>
  );
}

function ItineraryPreviewMock({ snapshot = false }: { snapshot?: boolean }) {
  const items = snapshot ? DAY_FLOW.slice(0, 3) : DAY_FLOW;

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-[var(--shadow-card)] ${
        snapshot ? "shadow-lg ring-1 ring-primary/15" : "shadow-lg ring-1 ring-primary/10"
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

      <ol className="space-y-0">
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
                  item.kind === "meal" ? "bg-accent" : item.kind === "rest" ? "bg-secondary" : "bg-primary"
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

function MobileHero() {
  return (
    <div className="lg:hidden">
      <section className="px-4 pb-4 pt-5 sm:px-6">
        <FamilyTravelyLogo className="h-auto w-32" />
        <h1 className="mt-5 text-[1.65rem] font-semibold leading-tight tracking-tight text-primary">{HERO_HEADLINE}</h1>
        <p className="mt-3 text-base font-medium italic leading-snug text-ink">{HERO_TAGLINE}</p>
      </section>

      <section className="relative px-3 pb-2 pt-1 sm:px-5">
        <div
          aria-hidden
          className="absolute inset-x-2 top-2 bottom-2 rounded-[1.25rem] bg-gradient-to-br from-primary-muted via-secondary-muted/80 to-primary-muted/40"
        />
        <div className="relative">
          <ItineraryPreviewMock snapshot />
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6">
        <p className="text-sm leading-relaxed text-muted">{HERO_BODY}</p>
        <PlanMyTripLink className="mt-4 w-full" />
        <ReassurancePill className="mt-3" />
      </section>
    </div>
  );
}

function DesktopHero() {
  return (
    <div className="mx-auto hidden max-w-6xl grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-center gap-10 px-6 py-12 sm:px-10 lg:grid lg:gap-12 lg:py-16">
      <section>
        <FamilyTravelyLogo className="h-auto w-44" />
        <h1 className="mt-8 max-w-xl text-3xl font-semibold tracking-tight text-primary sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
          {HERO_HEADLINE}
        </h1>
        <p className="mt-4 text-lg font-medium italic leading-snug text-ink sm:text-xl">{HERO_TAGLINE}</p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted">{HERO_BODY}</p>
        <PlanMyTripLink className="mt-8" />
        <ReassurancePill className="mt-3" />
      </section>

      <aside className="relative">
        <div
          aria-hidden
          className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary-muted via-secondary-muted/70 to-primary-muted/50 sm:-inset-6"
        />
        <div className="relative">
          <ItineraryPreviewMock />
        </div>
      </aside>
    </div>
  );
}

function MobileBelowFold() {
  return (
    <div className="lg:hidden">
      <section aria-labelledby="mobile-how-heading" className="border-t border-border bg-primary-muted/50 px-4 py-6 sm:px-6">
        <h2 id="mobile-how-heading" className="text-base font-semibold tracking-tight text-primary">
          How it works
        </h2>
        <ol className="mt-3 flex flex-col">
          {PRODUCT_HOW_STEPS.flatMap((step, i) => {
            const card = (
              <li key={step.step} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-border/60">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-muted text-xs font-bold tabular-nums text-primary">
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

      <section aria-labelledby="mobile-why-heading" className="border-t border-border bg-background px-4 py-6 sm:px-6">
        <h2 id="mobile-why-heading" className="text-base font-semibold tracking-tight text-primary">
          Why {BRAND.name}
        </h2>
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

      <section className="border-t border-border bg-background px-4 py-6 sm:px-6">
        <PlanMyTripLink variant="outline" className="w-full" />
      </section>
    </div>
  );
}

function DesktopBelowFold() {
  return (
    <div className="hidden lg:block">
      <section aria-labelledby="why-heading" className="border-t border-border bg-background">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
          <h2 id="why-heading" className="max-w-xl text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Spend less time figuring it all out.
          </h2>
          <p className="mt-3 max-w-none text-base leading-relaxed text-muted">
            Family travel comes with enough to think about. FamilyTravely handles the details so you can focus on
            enjoying the trip together.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {PRODUCT_WHY_CARDS.map((card) => (
              <li
                key={card.title}
                className="rounded-[1.5rem] border border-primary/25 bg-white p-5 text-left shadow-sm sm:p-6"
              >
                <span aria-hidden className="mb-4 block h-1 w-8 rounded-full bg-accent" />
                <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="day-plan-heading" className="border-t border-primary/10 bg-primary-muted/45">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
          <h2 id="day-plan-heading" className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Not just a list of places. A plan for your day.
          </h2>
          <p className="mt-4 max-w-none text-base leading-relaxed text-muted">
            FamilyTravely considers the whole day — including opening hours, travel time, meals, naps, and your
            family&apos;s energy — so your itinerary makes sense from morning to bedtime.
          </p>
          <div className="mt-10">
            <DayFlowStrip />
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="border-t border-border bg-primary-muted/35">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
          <h2 id="how-heading" className="text-center text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            From family details to a trip you can actually follow.
          </h2>
          <ol className="mt-12 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-2">
            {PRODUCT_HOW_STEPS.flatMap((step, i) => {
              const card = (
                <li
                  key={step.step}
                  className="flex h-full w-full flex-col rounded-[1.5rem] border border-border/70 bg-white p-6 text-left shadow-sm"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-muted text-sm font-bold tabular-nums text-primary">
                    {step.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              );

              if (i === PRODUCT_HOW_STEPS.length - 1) return [card];

              return [
                card,
                <li key={`${step.step}-arrow`} aria-hidden className="list-none flex items-center px-1">
                  <StepFlowArrow layout="horizontal" />
                </li>,
              ];
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="final-cta-heading" className="border-t border-border bg-primary">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center sm:py-20">
          <h2 id="final-cta-heading" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Make the memories. We&apos;ll handle the details.
          </h2>
          <p className="mt-3 max-w-none text-pretty text-base leading-relaxed text-white/80 sm:whitespace-nowrap">
            Your family trip shouldn&apos;t feel like another project to manage.
          </p>
          <PlanMyTripLink className="mt-8">Plan My Trip →</PlanMyTripLink>
          <p className="mt-3 text-sm text-white/70">Free to start · No account needed</p>
        </div>
      </section>
    </div>
  );
}

export default function ProductFirstHomepage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-muted/70 via-white to-background text-ink lg:from-primary-muted/45 lg:via-background">
      <MobileHero />
      <DesktopHero />
      <MobileBelowFold />
      <DesktopBelowFold />
      <p className="sr-only">{BRAND.slogan}</p>
    </main>
  );
}
