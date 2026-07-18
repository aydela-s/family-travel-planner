import Link from "next/link";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F5F2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(91,168,163,0.22),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(232,155,140,0.18),transparent_45%),radial-gradient(ellipse_at_50%_100%,rgba(31,95,90,0.08),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(31,95,90,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(31,95,90,0.04)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="animate-fade-in">
          <TripNestlyLogo className="mx-auto h-auto w-[min(100%,22rem)] sm:w-[26rem]" />
        </div>

        <h1 className="animate-fade-in mt-10 max-w-2xl text-3xl font-semibold tracking-tight text-[#1F5F5A] sm:text-4xl [animation-delay:120ms]">
          Plan your next family adventure
        </h1>

        <p className="animate-fade-in mt-4 max-w-xl text-base leading-relaxed text-[#3D6F6B] sm:text-lg [animation-delay:220ms]">
          Destinations, days, and details in one nest — built around how real families
          actually travel.
        </p>

        <Link
          href="/plan"
          className="animate-fade-in mt-10 inline-flex items-center justify-center rounded-full bg-[#1F5F5A] px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#174A46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F5A] [animation-delay:320ms]"
        >
          Plan my trip
        </Link>

        <p className="animate-fade-in sr-only">{BRAND.slogan}</p>
      </div>
    </main>
  );
}
