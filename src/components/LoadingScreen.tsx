"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/config/brand";
import { LOADING_MESSAGES } from "@/types/generate";

const ROUTE_PATH = "M20 90 C 55 8, 85 8, 120 56 S 165 112, 220 36";

type LoadingScreenProps = {
  message?: string;
  /** Optional chip, e.g. "Dallas · 3 days". */
  destinationLabel?: string;
};

export default function LoadingScreen({ message, destinationLabel }: LoadingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const endDotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [message]);

  useEffect(() => {
    const path = pathRef.current;
    const pin = pinRef.current;
    const endDot = endDotRef.current;
    if (!path || !pin || !endDot) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      const mid = path.getPointAtLength(path.getTotalLength() * 0.55);
      pin.setAttribute("transform", `translate(${mid.x} ${mid.y})`);
      endDot.setAttribute("opacity", "1");
      return;
    }

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
      const cover = Math.max(0, Math.min(1, (eased - 0.88) / 0.1));
      endDot.setAttribute("opacity", String(1 - cover));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const displayMessage = message ?? LOADING_MESSAGES[messageIndex];

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
      {destinationLabel ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          {destinationLabel}
        </div>
      ) : null}

      <svg
        viewBox="0 0 240 120"
        className={`h-36 w-full max-w-xs overflow-visible ${destinationLabel ? "mt-8" : ""}`}
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
          className="text-border animate-loading-route-dash"
        />
        <circle cx="20" cy="90" r="6" fill="#02bbcb" />
        <circle ref={endDotRef} cx="220" cy="36" r="6" className="fill-accent" />
        <g ref={pinRef}>
          <image href={BRAND.pinSrc} x="-14" y="-28" width="28" height="28" />
        </g>
      </svg>

      <p
        key={displayMessage}
        className="mt-4 animate-fade-in text-lg font-semibold text-ink"
        role="status"
      >
        {displayMessage}
      </p>
      {message ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Hang tight. This won’t take long.
        </p>
      ) : null}
    </div>
  );
}
