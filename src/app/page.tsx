import Link from "next/link";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(1,109,118,0.08),transparent_50%),radial-gradient(ellipse_at_90%_5%,rgba(2,187,203,0.10),transparent_45%),radial-gradient(ellipse_at_50%_100%,rgba(255,87,87,0.06),transparent_50%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="animate-fade-in">
          <TripNestlyLogo className="mx-auto h-auto w-[min(100%,22rem)] sm:w-[26rem]" />
        </div>

        <h1 className="animate-fade-in mt-10 max-w-2xl text-3xl font-semibold tracking-tight text-primary sm:text-4xl [animation-delay:120ms]">
          Plan your next family adventure
        </h1>

        <p className="animate-fade-in mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg [animation-delay:220ms]">
          Destinations, days, and details in one nest — built around how real families
          actually travel.
        </p>

        <Link
          href="/plan"
          className="animate-fade-in mt-10 inline-flex items-center justify-center rounded-2xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [animation-delay:320ms]"
        >
          Plan my trip
        </Link>

        <p className="animate-fade-in sr-only">{BRAND.slogan}</p>
      </div>
    </main>
  );
}
