"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  btnGhostClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
  inputClassName,
  labelClassName,
} from "@/components/plan-wizard/shared";
import { downloadItineraryPdf } from "@/lib/itinerary-pdf";
import { Itinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

type Status = "idle" | "sending" | "sent" | "error";

export default function ShareItineraryControls({
  itinerary,
  plan,
  disabled = false,
}: {
  itinerary: Itinerary;
  plan?: TripPlan;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function resetShareForm() {
    setTo("");
    setMessage("");
    setStatus("idle");
    setError("");
  }

  function close() {
    setOpen(false);
    if (status === "sent") resetShareForm();
  }

  function onDownload() {
    downloadItineraryPdf({
      itinerary,
      plan: plan
        ? {
            adults: plan.adults,
            children: plan.children,
            startDate: plan.startDate,
            endDate: plan.endDate,
          }
        : undefined,
    });
  }

  async function onShare(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/share-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          message: message.trim() || undefined,
          itinerary,
          plan,
          appOrigin: window.location.origin,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Couldn’t send the itinerary.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Couldn’t reach the server. Check your connection and try again.");
    }
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
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  Share itinerary
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl px-2 py-1 text-sm font-semibold text-muted hover:bg-background hover:text-ink"
                  aria-label="Close share dialog"
                >
                  ✕
                </button>
              </div>

              {status === "sent" ? (
                <div className="mt-5 space-y-4">
                  <p className="rounded-2xl border border-primary/20 bg-primary-muted px-4 py-3.5 text-sm leading-relaxed text-ink">
                    Sent — they should see it in their inbox shortly.
                  </p>
                  <button type="button" onClick={close} className={btnPrimaryClassName}>
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={onShare} className="mt-5 space-y-4">
                  <label className={labelClassName}>
                    Email to
                    <input
                      type="email"
                      required
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="friend@example.com"
                      className={inputClassName}
                      autoComplete="email"
                    />
                  </label>
                  <label className={labelClassName}>
                    Note{" "}
                    <span className="font-normal text-muted">(optional)</span>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Here’s our family plan for Paris!"
                      className={`${inputClassName} resize-y`}
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
                      {status === "sending" ? "Sending…" : "Send itinerary"}
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            if (status === "sent") resetShareForm();
          }}
          className={btnSecondaryClassName}
        >
          Share by email
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDownload}
          className={btnPrimaryClassName}
        >
          Download PDF
        </button>
      </div>
      {dialog}
    </>
  );
}
