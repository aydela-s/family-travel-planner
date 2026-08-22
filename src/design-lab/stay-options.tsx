"use client";

import { useState } from "react";
import Link from "next/link";

type StayKind = "hotel" | "rental" | "friends" | "unknown" | "";
type HotelBreakfast = "included" | "no" | "";
type RentalKitchen = "yes" | "no" | "";
type Transit = "car" | "taxi" | "transit" | "";

const STAY_KINDS: { id: Exclude<StayKind, "">; label: string; emoji: string }[] = [
  { id: "hotel", label: "Hotel", emoji: "🏨" },
  { id: "rental", label: "Rental", emoji: "🏠" },
  { id: "friends", label: "With family or friends", emoji: "👨‍👩‍👧" },
  { id: "unknown", label: "I don’t know yet", emoji: "🤷" },
];

const TRANSIT: { id: Exclude<Transit, "">; label: string; emoji: string }[] = [
  { id: "car", label: "Car", emoji: "🚗" },
  { id: "taxi", label: "Taxi", emoji: "🚕" },
  { id: "transit", label: "Public transit", emoji: "🚇" },
];

function AddressField({
  value,
  onChange,
  disabled,
  placeholder = "Hotel or address",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-0.5">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              selected ? "bg-primary text-white" : "text-muted hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** A — Dense form: pill chips + inline follow-ups, transit as icon strip. */
function OptionDenseForm() {
  const [kind, setKind] = useState<StayKind>("hotel");
  const [breakfast, setBreakfast] = useState<HotelBreakfast>("included");
  const [kitchen, setKitchen] = useState<RentalKitchen>("yes");
  const [address, setAddress] = useState("Hotel Del Coronado");
  const [transit, setTransit] = useState<Transit>("car");

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-ink">Stay & getting around</h3>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Stay type</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAY_KINDS.map((opt) => {
            const selected = kind === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setKind(opt.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  selected
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-ink hover:bg-secondary-muted"
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {kind === "hotel" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Breakfast</span>
          <Segmented
            value={breakfast}
            onChange={(id) => setBreakfast(id as HotelBreakfast)}
            options={[
              { id: "included", label: "Included" },
              { id: "no", label: "Not included" },
            ]}
          />
        </div>
      ) : null}

      {kind === "rental" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Kitchen</span>
          <Segmented
            value={kitchen}
            onChange={(id) => setKitchen(id as RentalKitchen)}
            options={[
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ]}
          />
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Address</p>
        <div className="mt-1.5">
          <AddressField
            value={kind === "unknown" ? "" : address}
            onChange={setAddress}
            disabled={kind === "unknown"}
            placeholder={kind === "unknown" ? "City center until booked" : "Hotel or address"}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Getting around</p>
        <div className="mt-2 flex gap-1">
          {TRANSIT.map((opt) => {
            const selected = transit === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.label}
                onClick={() => setTransit(opt.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition ${
                  selected
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-muted hover:bg-secondary-muted hover:text-ink"
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {opt.emoji}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** B — Split board: Stay column | Move column (two jobs side by side). */
function OptionSplitBoard() {
  const [kind, setKind] = useState<StayKind>("rental");
  const [breakfast, setBreakfast] = useState<HotelBreakfast>("");
  const [kitchen, setKitchen] = useState<RentalKitchen>("yes");
  const [address, setAddress] = useState("");
  const [transit, setTransit] = useState<Transit>("car");

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-ink">Base & move</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-background p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Where you sleep</p>
          <ul className="mt-2 space-y-1">
            {STAY_KINDS.map((opt) => {
              const selected = kind === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => setKind(opt.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      selected ? "bg-primary-muted font-semibold text-primary" : "text-ink hover:bg-surface"
                    }`}
                  >
                    <span aria-hidden>{opt.emoji}</span>
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {kind === "hotel" ? (
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <p className="text-xs text-muted">Breakfast?</p>
              {(["included", "no"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBreakfast(id)}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                    breakfast === id ? "bg-primary text-white" : "border border-border bg-surface text-ink"
                  }`}
                >
                  {id === "included" ? "Included" : "Not included"}
                </button>
              ))}
            </div>
          ) : null}

          {kind === "rental" ? (
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <p className="text-xs text-muted">Kitchen?</p>
              {(["yes", "no"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKitchen(id)}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                    kitchen === id ? "bg-primary text-white" : "border border-border bg-surface text-ink"
                  }`}
                >
                  {id === "yes" ? "Has kitchen" : "No kitchen"}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 border-t border-border pt-3">
            <AddressField
              value={kind === "unknown" ? "" : address}
              onChange={setAddress}
              disabled={kind === "unknown"}
              placeholder={kind === "unknown" ? "Optional later" : "Name or address"}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">How you move</p>
          <ul className="mt-2 space-y-2">
            {TRANSIT.map((opt) => {
              const selected = transit === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => setTransit(opt.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-ink hover:bg-secondary-muted"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {opt.emoji}
                    </span>
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

type MicroStep = "stay" | "detail" | "address" | "transit";

/** C — Micro-wizard: one question at a time with a progress rail. */
function OptionMicroWizard() {
  const [step, setStep] = useState<MicroStep>("stay");
  const [kind, setKind] = useState<StayKind>("");
  const [breakfast, setBreakfast] = useState<HotelBreakfast>("");
  const [kitchen, setKitchen] = useState<RentalKitchen>("");
  const [address, setAddress] = useState("");
  const [transit, setTransit] = useState<Transit>("");

  const needsDetail = kind === "hotel" || kind === "rental";
  const steps: MicroStep[] = needsDetail
    ? ["stay", "detail", "address", "transit"]
    : ["stay", "address", "transit"];
  const stepIndex = Math.max(0, steps.indexOf(step));

  function goNext() {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]!);
  }

  function goBack() {
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]!);
  }

  function pickKind(next: Exclude<StayKind, "">) {
    setKind(next);
    setBreakfast("");
    setKitchen("");
    if (next === "hotel" || next === "rental") setStep("detail");
    else setStep("address");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">One thing at a time</h3>
        <p className="text-xs tabular-nums text-muted">
          {stepIndex + 1} / {steps.length}
        </p>
      </div>

      <div className="flex gap-1">
        {steps.map((id, index) => (
          <div
            key={id}
            className={`h-1 flex-1 rounded-full ${index <= stepIndex ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      {step === "stay" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">What kind of stay?</p>
          <div className="grid grid-cols-2 gap-2">
            {STAY_KINDS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => pickKind(opt.id)}
                className={`rounded-2xl border px-3 py-4 text-center text-sm font-medium transition ${
                  kind === opt.id
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-border bg-surface text-ink hover:bg-secondary-muted"
                }`}
              >
                <span className="block text-2xl" aria-hidden>
                  {opt.emoji}
                </span>
                <span className="mt-1 block">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === "detail" && kind === "hotel" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Is breakfast included?</p>
          {(["included", "no"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setBreakfast(id);
                setStep("address");
              }}
              className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium ${
                breakfast === id
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-ink hover:bg-secondary-muted"
              }`}
            >
              {id === "included" ? "Yes — breakfast included" : "No breakfast"}
            </button>
          ))}
        </div>
      ) : null}

      {step === "detail" && kind === "rental" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Does it have a kitchen?</p>
          {(["yes", "no"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setKitchen(id);
                setStep("address");
              }}
              className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium ${
                kitchen === id
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-ink hover:bg-secondary-muted"
              }`}
            >
              {id === "yes" ? "Yes — full kitchen" : "No kitchen"}
            </button>
          ))}
        </div>
      ) : null}

      {step === "address" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">
            {kind === "unknown" ? "Skip address for now" : "Where exactly?"}
          </p>
          {kind === "unknown" ? (
            <p className="rounded-xl bg-background px-3 py-2 text-sm text-muted">
              We’ll use the city center until you book.
            </p>
          ) : (
            <AddressField value={address} onChange={setAddress} placeholder="Search stay name or address" />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {step === "transit" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">How will you get around?</p>
          {TRANSIT.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTransit(opt.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium ${
                transit === opt.id
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-ink hover:bg-secondary-muted"
              }`}
            >
              <span aria-hidden>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={goBack}
            className="mt-1 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted"
          >
            Back
          </button>
        </div>
      ) : null}
    </div>
  );
}

const OPTIONS = [
  {
    id: "dense",
    title: "A — Dense form",
    summary:
      "Everything on one screen: stay as pills, breakfast/kitchen as a tiny segmented control, transit as a 3-icon strip (Car / Taxi / Public transit — no walking). No big cards.",
    idea: "Compress vertical space",
    Component: OptionDenseForm,
  },
  {
    id: "split",
    title: "B — Split board",
    summary:
      "Two columns: sleep on the left (list + address), move on the right (full-width transit rows). Stay and transit read as equal jobs.",
    idea: "Separate the two decisions",
    Component: OptionSplitBoard,
  },
  {
    id: "micro",
    title: "C — Micro-wizard",
    summary:
      "One question per beat with a progress rail. Hotel/rental insert a detail step; friends / not-booked skip it. Feels sequential, not stacked.",
    idea: "Progressive disclosure",
    Component: OptionMicroWizard,
  },
] as const;

export function StayOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Wizard · Stay</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Stay & getting around layouts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Three different ways to collect stay type, optional detail (breakfast / kitchen), address, and transit — vs.
          today&apos;s stacked OptionCards. Each panel is interactive.
        </p>
        <p className="mt-2 text-sm text-muted">
          Current reference:{" "}
          <Link href="/design-lab/harbor/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Harbor wizard
          </Link>
          {" · "}
          production now uses option A (no walking).
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {OPTIONS.map(({ id, title, summary, idea, Component }) => (
            <article
              key={id}
              className="flex flex-col rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{idea}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{summary}</p>
              <div className="mt-5 flex-1 rounded-2xl border border-border/70 bg-background/80 p-4">
                <Component />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
