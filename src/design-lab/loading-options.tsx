"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { FamilyTravelyLogo } from "@/components/FamilyTravelyLogo";
import { LOADING_MESSAGES } from "@/types/generate";

const STAGES = [
  { id: "places", label: "Finding great places nearby" },
  { id: "rest", label: "Planning rest breaks" },
  { id: "meals", label: "Picking family-friendly meals" },
  { id: "route", label: "Mapping a day that flows" },
] as const;

function LoadingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-background p-4 sm:p-6">
      <div className="mb-4 inline-flex opacity-90">
        <FamilyTravelyLogo className="h-auto w-40" />
      </div>
      <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
        {children}
      </div>
    </div>
  );
}

/** A — Itinerary skeleton materializes with shimmer day cards. */
function OptionASkeleton() {
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLit((n) => (n + 1) % 4), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <div className="text-center">
        <p className="text-lg font-semibold text-ink">Building your Dallas itinerary</p>
        <p className="mt-2 text-sm text-muted">Watching the week come together…</p>
      </div>

      <div className="mt-8 space-y-3" aria-hidden>
        {["Day 1", "Day 2", "Day 3"].map((day, dayIndex) => (
          <div
            key={day}
            className={`rounded-2xl border border-border bg-background p-4 transition-opacity duration-500 ${
              dayIndex <= lit ? "opacity-100" : "opacity-40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">{day}</span>
              <span
                className={`h-2 w-16 rounded-full ${
                  dayIndex < lit ? "bg-primary/40" : "lab-loading-shimmer"
                }`}
              />
            </div>
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <span
                    className={`h-8 w-8 shrink-0 rounded-xl ${
                      dayIndex < lit || (dayIndex === lit && row <= lit % 3)
                        ? "bg-primary-muted"
                        : "lab-loading-shimmer"
                    }`}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div
                      className={`h-2.5 rounded-full ${
                        dayIndex < lit ? "w-3/4 bg-ink/15" : "lab-loading-shimmer w-3/4"
                      }`}
                    />
                    <div
                      className={`h-2 rounded-full ${
                        dayIndex < lit ? "w-1/2 bg-ink/10" : "lab-loading-shimmer w-1/2"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm font-medium text-ink" role="status">
        {LOADING_MESSAGES[lit % LOADING_MESSAGES.length]}
      </p>
    </div>
  );
}

/** B — Sequential planning checklist with soft checks. */
function OptionBChecklist() {
  const [doneThrough, setDoneThrough] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setDoneThrough((n) => (n >= STAGES.length ? 0 : n + 1));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const activeIndex = Math.min(doneThrough, STAGES.length - 1);
  const allDone = doneThrough >= STAGES.length;

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <p className="text-lg font-semibold text-ink">Putting your plan together</p>
        <p className="mt-2 text-sm text-muted">A few quick checks before we show the week.</p>
      </div>

      <ol className="mt-8 space-y-3" aria-live="polite">
        {STAGES.map((stage, index) => {
          const done = allDone || index < doneThrough;
          const active = !allDone && index === activeIndex && index === doneThrough;
          return (
            <li
              key={stage.id}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300 ${
                done
                  ? "border-primary/25 bg-primary-muted"
                  : active
                    ? "border-primary bg-surface"
                    : "border-border bg-background"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done
                    ? "bg-primary text-white"
                    : active
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted"
                }`}
                aria-hidden
              >
                {done ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path
                      d="M5 10.5 8.5 14 15 6.5"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`text-sm font-medium ${
                  done || active ? "text-ink" : "text-muted"
                }`}
              >
                {stage.label}
                {active ? "…" : ""}
              </span>
              {active ? (
                <span className="ml-auto flex gap-1" aria-hidden>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, (doneThrough / STAGES.length) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** C — Destination route with traveling pin + rotating status. */
const ROUTE_PATH = "M20 90 C 55 8, 85 8, 120 56 S 165 112, 220 36";

function OptionCRoute() {
  const [messageIndex, setMessageIndex] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const endDotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((n) => (n + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const path = pathRef.current;
    const pin = pinRef.current;
    const endDot = endDotRef.current;
    if (!path || !pin || !endDot) return;

    const durationMs = 3800;
    let frame = 0;
    const start = performance.now();

    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now: number) => {
      const t = ((now - start) % durationMs) / durationMs;
      const eased = easeInOut(t);
      const length = path.getTotalLength();
      const point = path.getPointAtLength(eased * length);
      pin.setAttribute("transform", `translate(${point.x} ${point.y})`);
      // Fade the destination dot under the pin as it arrives so the pin sits clearly on top.
      const cover = Math.max(0, Math.min(1, (eased - 0.88) / 0.1));
      endDot.setAttribute("opacity", String(1 - cover));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const message = LOADING_MESSAGES[messageIndex];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        Dallas · 3 days
      </div>

      <svg
        viewBox="0 0 240 120"
        className="mt-10 h-36 w-full max-w-xs overflow-visible"
        aria-hidden
      >
        <path
          ref={pathRef}
          d={ROUTE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="6 8"
          strokeLinecap="round"
          className="text-border lab-loading-dash"
        />
        <circle cx="20" cy="90" r="6" fill="#02bbcb" />
        <circle
          ref={endDotRef}
          cx="220"
          cy="36"
          r="6"
          className="fill-accent"
        />
        {/* Pin last so it paints above the coral endpoint. */}
        <g ref={pinRef}>
          <image href={BRAND.pinSrc} x="-14" y="-28" width="28" height="28" />
        </g>
      </svg>

      <p key={message} className="mt-4 animate-fade-in text-lg font-semibold text-ink" role="status">
        {message}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Building a plan your whole family can actually enjoy…
      </p>
    </div>
  );
}

const OPTIONS = [
  {
    id: "a",
    title: "A · Skeleton assemble",
    summary:
      "Day cards fade in with shimmer slots — feels like the itinerary UI is materializing before your eyes.",
    Preview: OptionASkeleton,
  },
  {
    id: "b",
    title: "B · Planning checklist",
    summary:
      "Named stages check off one by one with a progress bar. Clear what’s happening; less mysterious wait.",
    Preview: OptionBChecklist,
  },
  {
    id: "c",
    title: "C · Route + pin",
    summary:
      "Destination chip, dashed path with pin riding the curve, rotating status. Calm and brand-forward.",
    Preview: OptionCRoute,
  },
] as const;

export function LoadingOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Itinerary generate</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Loading the itinerary</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Three full-screen waiting experiences for after Generate. Same Dallas story; different motion and
          information density. Production uses option C (route + pin).
        </p>
        <p className="mt-2 text-sm text-muted">
          <Link href="/design-lab/harbor/trip" className="font-medium text-primary underline-offset-2 hover:underline">
            Open Harbor itinerary
          </Link>
          {" · "}
          production loading screen matches option C.
        </p>

        <div className="mt-10 space-y-10">
          {OPTIONS.map((option) => (
            <article key={option.id}>
              <div className="mb-4 max-w-2xl">
                <h2 className="text-lg font-semibold text-ink">{option.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{option.summary}</p>
              </div>
              <LoadingChrome>
                <option.Preview />
              </LoadingChrome>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
