import Link from "next/link";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-amber-50">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <TripNestlyLogo
          showTagline
          className="mb-8 h-auto w-[5in] max-w-full"
        />

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Plan your next family adventure
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
          Organize destinations, activities, and travel dates in one place so
          everyone in the family stays excited and on the same page.
        </p>

        <Link
          href="/plan"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-sky-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          Plan my trip
        </Link>

        <div className="mt-16 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {[
            { title: "Pick destinations", detail: "Save places everyone wants to visit" },
            { title: "Build itineraries", detail: "Map out days with kid-friendly stops" },
            { title: "Travel together", detail: "Share plans and keep the whole crew aligned" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/70 bg-white/70 p-5 text-left shadow-sm backdrop-blur"
            >
              <h2 className="font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
