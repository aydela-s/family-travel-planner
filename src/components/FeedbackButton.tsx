"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useFeedbackVisibility } from "@/components/FeedbackVisibility";
import {
  btnGhostClassName,
  btnPrimaryClassName,
  inputClassName,
  labelClassName,
} from "@/components/plan-wizard/shared";
import { trackFeedbackSubmitted } from "@/lib/analytics";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackButton() {
  const pathname = usePathname();
  const { allowed } = useFeedbackVisibility();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!allowed && open) setOpen(false);
  }, [allowed, open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function resetForm() {
    setMessage("");
    setEmail("");
    setStatus("idle");
    setError("");
  }

  function close() {
    setOpen(false);
    if (status === "sent") resetForm();
  }

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
      trackFeedbackSubmitted({ source: "floating_button" });
    } catch {
      setStatus("error");
      setError("Couldn’t reach the server. Check your connection and try again.");
    }
  }

  // Dedicated /feedback page already has the form — don’t stack a floating launcher.
  // Planner (itinerary view) opts in via FeedbackVisibilityProvider — never the wizard (FAM-79).
  if (pathname === "/feedback" || !allowed) {
    return null;
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 px-4 pb-8 pt-8 sm:pt-16"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id={titleId} className="text-lg font-semibold text-ink">
                    Send feedback
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Bugs, confusing steps, or ideas — we read every note.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl px-2 py-1 text-sm font-semibold text-muted hover:bg-background hover:text-ink"
                  aria-label="Close feedback"
                >
                  ✕
                </button>
              </div>

              {status === "sent" ? (
                <div className="mt-5 space-y-4">
                  <p className="rounded-2xl border border-primary/20 bg-primary-muted px-4 py-3.5 text-sm leading-relaxed text-ink">
                    Thanks — your feedback is on its way.
                  </p>
                  <button type="button" onClick={close} className={btnPrimaryClassName}>
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="mt-5 space-y-4">
                  <label className={labelClassName}>
                    Your feedback
                    <textarea
                      rows={5}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="What happened, or what would make TripNestly better?"
                      className={`${inputClassName} min-h-[8rem] resize-y`}
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className={btnPrimaryClassName}
                    >
                      {status === "sending" ? "Sending…" : "Send feedback"}
                    </button>
                    <button type="button" onClick={close} className={btnGhostClassName}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (status === "sent") resetForm();
        }}
        className="fixed bottom-6 left-6 z-30 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:border-primary/40 hover:bg-primary-muted hover:text-primary"
      >
        Feedback
      </button>
      {dialog}
    </>
  );
}
