"use client";

import Link from "next/link";

const ctaClassName =
  "inline-flex items-center justify-center rounded-2xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function PlanMyTripLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/plan" className={`${ctaClassName} ${className}`.trim()} prefetch>
      Plan my trip
    </Link>
  );
}
