"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { TripNestlyLogo } from "@/components/TripNestlyLogo";
import { BRAND } from "@/config/brand";
import {
  btnGhostClassName,
  btnPrimaryClassName,
  inputClassName,
  labelClassName,
} from "@/components/plan-wizard/shared";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          email: email.trim() || undefined,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Couldn’t send feedback. Please try again.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn’t reach the server. Check your connection and try again.");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-primary transition hover:opacity-80"
        >
          <TripNestlyLogo variant="mark" className="h-10 w-auto shrink-0" />
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>

        <div className="mt-6 rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Send feedback</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Bugs, confusing steps, or ideas — we read every note.
          </p>

          {status === "sent" ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-2xl border border-primary/20 bg-primary-muted px-4 py-3.5 text-sm leading-relaxed text-ink">
                Thanks — your feedback is on its way.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/" className={btnPrimaryClassName}>
                  Back to home
                </Link>
                <Link href="/plan" className={btnGhostClassName}>
                  Plan a trip
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className={labelClassName}>
                Your feedback
                <textarea
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, or what would make TripNestly better?"
                  className={`${inputClassName} min-h-[9rem] resize-y`}
                />
              </label>
              <label className={labelClassName}>
                Email{" "}
                <span className="font-normal text-muted">(optional, for follow-up)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClassName}
                  autoComplete="email"
                />
              </label>
              {error && (
                <p className="rounded-2xl border border-error/20 bg-error-muted px-4 py-3 text-sm text-error">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className={btnPrimaryClassName}
              >
                {status === "sending" ? "Sending…" : "Send feedback"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
