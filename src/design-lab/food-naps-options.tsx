"use client";

import { useState } from "react";
import Link from "next/link";
import { NAP_TIME_OPTIONS } from "@/lib/planning-engine/nap-options";
import {
  dietaryQuickPicks,
  FieldHint,
  inputClassName,
  SelectChip,
  StepIntro,
} from "@/components/plan-wizard/shared";

type NapType = "regular" | "stroller";
type NapWindow = { startTime: string; endTime: string; type: NapType };

const DEFAULT_NAP: NapWindow = {
  startTime: "12:00 PM",
  endTime: "2:00 PM",
  type: "regular",
};

const NAP_PRESETS: { id: string; label: string; start: string; end: string }[] = [
  { id: "mid", label: "Midday 12–2", start: "12:00 PM", end: "2:00 PM" },
  { id: "early", label: "Early 11–1", start: "11:00 AM", end: "1:00 PM" },
  { id: "late", label: "Afternoon 1–3", start: "1:00 PM", end: "3:00 PM" },
];

function minutesFromLabel(label: string): number {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const ap = match[3]!.toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function toggleDiet(current: string[], pick: string) {
  return current.includes(pick) ? current.filter((p) => p !== pick) : [...current, pick];
}

function WizardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
      {children}
    </div>
  );
}

/**
 * Hybrid — current food UI + Option A naps, side-by-side nap cards,
 * current underline Remove control.
 */
function OptionHybridFoodCurrentNapsA() {
  const [diet, setDiet] = useState<string[]>(["Gluten-free"]);
  const [naps, setNaps] = useState<NapWindow[]>([
    { ...DEFAULT_NAP },
    { startTime: "3:30 PM", endTime: "4:30 PM", type: "stroller" },
  ]);

  function applyPreset(start: string, end: string) {
    setNaps([{ startTime: start, endTime: end, type: naps[0]?.type ?? "regular" }]);
  }

  function updateNap(index: number, patch: Partial<NapWindow>) {
    setNaps(naps.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  }

  function removeNap(index: number) {
    setNaps(naps.filter((_, i) => i !== index));
  }

  function addNap() {
    if (naps.length >= 3) return;
    setNaps([...naps, { ...DEFAULT_NAP }]);
  }

  return (
    <WizardFrame>
      <div className="space-y-6">
        <StepIntro emoji="🍽️" title="Food & naps" />

        {/* Current food UI */}
        <div>
          <p className="text-sm font-semibold text-ink">Quick dietary picks</p>
          <FieldHint>Tap anything that applies.</FieldHint>
          <div className="mt-3 flex flex-wrap gap-2">
            {dietaryQuickPicks.map((pick) => (
              <SelectChip
                key={pick}
                selected={diet.includes(pick)}
                onClick={() => setDiet(toggleDiet(diet, pick))}
              >
                {pick}
              </SelectChip>
            ))}
          </div>
        </div>

        {/* Option A naps — side by side, current Remove */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">Nap schedule</p>

          <div className="flex flex-wrap gap-2">
            {NAP_PRESETS.map((preset) => {
              const selected =
                naps.length === 1 &&
                naps[0]!.startTime === preset.start &&
                naps[0]!.endTime === preset.end;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.start, preset.end)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    selected
                      ? "bg-primary-muted text-primary"
                      : "border border-border bg-background text-ink hover:bg-secondary-muted"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {naps.map((nap, index) => (
              <div
                key={index}
                className="space-y-3 rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Nap #{index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeNap(index)}
                    className="text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-ink">
                    Start time
                    <select
                      value={nap.startTime}
                      aria-label={`Nap ${index + 1} start time`}
                      onChange={(e) => updateNap(index, { startTime: e.target.value })}
                      className={inputClassName}
                    >
                      {NAP_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    End time
                    <select
                      value={nap.endTime}
                      aria-label={`Nap ${index + 1} end time`}
                      onChange={(e) => updateNap(index, { endTime: e.target.value })}
                      className={inputClassName}
                    >
                      {NAP_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="text-sm font-medium text-ink">Type</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        { value: "regular" as const, label: "Regular Nap" },
                        { value: "stroller" as const, label: "Stroller Nap" },
                      ] as const
                    ).map((opt) => (
                      <SelectChip
                        key={opt.value}
                        selected={nap.type === opt.value}
                        onClick={() => updateNap(index, { type: opt.value })}
                      >
                        {opt.label}
                      </SelectChip>
                    ))}
                  </div>
                  <FieldHint>
                    {nap.type === "stroller"
                      ? "We’ll keep quiet, low-key stops during this window."
                      : "We’ll skip attractions during this window."}
                  </FieldHint>
                </div>
              </div>
            ))}
          </div>

          {naps.length < 3 ? (
            <button
              type="button"
              onClick={addNap}
              className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              + Add another nap
            </button>
          ) : null}

          {naps.length === 0 ? (
            <p className="text-sm text-muted">
              No nap windows yet.{" "}
              <button
                type="button"
                onClick={addNap}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Add a nap
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </WizardFrame>
  );
}

/** A — Compact inline: diet chips + nap presets + one slim row editor. */
function OptionCompactInline() {
  const [diet, setDiet] = useState<string[]>(["Gluten-free"]);
  const [noNaps, setNoNaps] = useState(false);
  const [naps, setNaps] = useState<NapWindow[]>([{ ...DEFAULT_NAP }]);

  function applyPreset(start: string, end: string) {
    setNoNaps(false);
    setNaps([{ startTime: start, endTime: end, type: naps[0]?.type ?? "regular" }]);
  }

  return (
    <WizardFrame>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Food & naps</h2>
          <p className="mt-1 text-sm text-muted">Compact — fewer cards, more one-line controls.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Diet</span>
          {dietaryQuickPicks.map((pick) => {
            const on = diet.includes(pick);
            return (
              <button
                key={pick}
                type="button"
                onClick={() => setDiet(toggleDiet(diet, pick))}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  on ? "bg-primary text-white" : "border border-border bg-background text-ink hover:bg-secondary-muted"
                }`}
              >
                {pick}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Naps</span>
            <button
              type="button"
              onClick={() => setNoNaps(!noNaps)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                noNaps ? "bg-primary text-white" : "border border-border text-muted hover:text-ink"
              }`}
            >
              No naps needed
            </button>
          </div>

          {!noNaps ? (
            <>
              <div className="flex flex-wrap gap-2">
                {NAP_PRESETS.map((preset) => {
                  const selected =
                    naps.length === 1 &&
                    naps[0]!.startTime === preset.start &&
                    naps[0]!.endTime === preset.end;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.start, preset.end)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                        selected
                          ? "bg-primary-muted text-primary"
                          : "border border-border bg-background text-ink hover:bg-secondary-muted"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {naps.map((nap, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-3 rounded-xl bg-background px-3 py-3"
                >
                  <label className="text-sm text-ink">
                    <span className="text-muted">From</span>
                    <select
                      value={nap.startTime}
                      onChange={(e) => {
                        const next = [...naps];
                        next[index] = { ...nap, startTime: e.target.value };
                        setNaps(next);
                      }}
                      className="mt-1 block h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    >
                      {NAP_TIME_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-ink">
                    <span className="text-muted">To</span>
                    <select
                      value={nap.endTime}
                      onChange={(e) => {
                        const next = [...naps];
                        next[index] = { ...nap, endTime: e.target.value };
                        setNaps(next);
                      }}
                      className="mt-1 block h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    >
                      {NAP_TIME_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <div className="inline-flex rounded-full border border-border p-0.5">
                    {(["regular", "stroller"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const next = [...naps];
                          next[index] = { ...nap, type };
                          setNaps(next);
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                          nap.type === type ? "bg-primary text-white" : "text-muted"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {naps.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setNaps(naps.filter((_, i) => i !== index))}
                      className="ml-auto text-xs font-medium text-muted hover:text-ink"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}

              {naps.length < 3 ? (
                <button
                  type="button"
                  onClick={() => setNaps([...naps, { ...DEFAULT_NAP }])}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  + Add another nap
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">We’ll keep the day flowing without nap windows.</p>
          )}
        </div>
      </div>
    </WizardFrame>
  );
}

/** B — Day timeline: drag-feel nap blocks on a 7am–7pm strip. */
function OptionDayTimeline() {
  const [diet, setDiet] = useState<string[]>([]);
  const [noNaps, setNoNaps] = useState(false);
  const [naps, setNaps] = useState<NapWindow[]>([
    { startTime: "12:00 PM", endTime: "2:00 PM", type: "regular" },
  ]);
  const [notes, setNotes] = useState("");

  const dayStart = 7 * 60;
  const dayEnd = 19 * 60;
  const span = dayEnd - dayStart;

  return (
    <WizardFrame>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">How the day flexes</h2>
          <p className="mt-1 text-sm text-muted">Naps as blocks on the day — food as a quiet footer.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Nap windows</p>
          <button
            type="button"
            onClick={() => setNoNaps(!noNaps)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              noNaps ? "bg-primary text-white" : "border border-border text-muted"
            }`}
          >
            No naps
          </button>
        </div>

        {!noNaps ? (
          <div className="space-y-4">
            <div className="relative h-16 overflow-hidden rounded-2xl border border-border bg-background">
              <div className="absolute inset-x-0 top-0 flex h-5 justify-between px-2 text-[10px] text-muted">
                <span>7a</span>
                <span>10a</span>
                <span>1p</span>
                <span>4p</span>
                <span>7p</span>
              </div>
              <div className="absolute inset-x-2 bottom-2 top-6">
                {naps.map((nap, index) => {
                  const start = minutesFromLabel(nap.startTime);
                  const end = minutesFromLabel(nap.endTime);
                  const left = `${((Math.max(start, dayStart) - dayStart) / span) * 100}%`;
                  const width = `${(Math.max(30, end - start) / span) * 100}%`;
                  return (
                    <div
                      key={index}
                      className={`absolute top-0 flex h-full items-center justify-center rounded-lg text-[10px] font-semibold text-white ${
                        nap.type === "stroller" ? "bg-secondary" : "bg-primary"
                      }`}
                      style={{ left, width }}
                      title={`${nap.startTime}–${nap.endTime}`}
                    >
                      Nap {index + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {naps.map((nap, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <label className="text-sm">
                  <span className="text-muted">Start</span>
                  <select
                    value={nap.startTime}
                    onChange={(e) => {
                      const next = [...naps];
                      next[index] = { ...nap, startTime: e.target.value };
                      setNaps(next);
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                  >
                    {NAP_TIME_OPTIONS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-muted">End</span>
                  <select
                    value={nap.endTime}
                    onChange={(e) => {
                      const next = [...naps];
                      next[index] = { ...nap, endTime: e.target.value };
                      setNaps(next);
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                  >
                    {NAP_TIME_OPTIONS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-1">
                  {(["regular", "stroller"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const next = [...naps];
                        next[index] = { ...nap, type };
                        setNaps(next);
                      }}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize ${
                        nap.type === type
                          ? "bg-primary text-white"
                          : "border border-border text-muted"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNaps(naps.filter((_, i) => i !== index))}
                  className="h-10 text-sm text-muted hover:text-ink"
                >
                  Remove
                </button>
              </div>
            ))}

            {naps.length < 3 ? (
              <button
                type="button"
                onClick={() => setNaps([...naps, { ...DEFAULT_NAP, type: "stroller" }])}
                className="rounded-full border border-dashed border-border px-4 py-2 text-sm font-medium text-primary"
              >
                + Drop another window on the day
              </button>
            ) : null}

            <p className="text-xs text-muted">
              Teal = regular nap (skip attractions). Secondary tint = stroller nap (quiet stops ok).
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">
            Full day open — no nap blocks on the timeline.
          </p>
        )}

        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold text-ink">Food notes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dietaryQuickPicks.map((pick) => {
              const on = diet.includes(pick);
              return (
                <button
                  key={pick}
                  type="button"
                  onClick={() => setDiet(toggleDiet(diet, pick))}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    on
                      ? "border-primary bg-primary-muted text-primary"
                      : "border-border bg-surface text-ink"
                  }`}
                >
                  {pick}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else about meals? (optional)"
            className="mt-3 h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-muted"
          />
        </div>
      </div>
    </WizardFrame>
  );
}

/** C — Two equal panels: Food | Naps side-by-side at full wizard width. */
function OptionTwinPanels() {
  const [diet, setDiet] = useState<string[]>(["Vegetarian"]);
  const [extra, setExtra] = useState("");
  const [mode, setMode] = useState<"schedule" | "none">("schedule");
  const [naps, setNaps] = useState<NapWindow[]>([{ ...DEFAULT_NAP }]);

  return (
    <WizardFrame>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Food & naps</h2>
          <p className="mt-1 text-sm text-muted">Two equal jobs — eat and rest — side by side.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-background p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Food</p>
            <p className="mt-1 text-sm text-muted">What should restaurants respect?</p>
            <ul className="mt-4 space-y-2">
              {dietaryQuickPicks.map((pick) => {
                const on = diet.includes(pick);
                return (
                  <li key={pick}>
                    <button
                      type="button"
                      onClick={() => setDiet(toggleDiet(diet, pick))}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                        on
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-surface text-ink hover:bg-secondary-muted"
                      }`}
                    >
                      {pick}
                      <span className="text-xs opacity-80">{on ? "On" : "Off"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <label className="mt-4 block text-sm text-muted">
              Other notes
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                placeholder="Nut allergy, kosher, etc."
              />
            </label>
          </section>

          <section className="rounded-2xl border border-border bg-background p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Naps</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("schedule")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                  mode === "schedule" ? "bg-primary text-white" : "border border-border text-ink"
                }`}
              >
                Schedule windows
              </button>
              <button
                type="button"
                onClick={() => setMode("none")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                  mode === "none" ? "bg-primary text-white" : "border border-border text-ink"
                }`}
              >
                No naps
              </button>
            </div>

            {mode === "schedule" ? (
              <div className="mt-4 space-y-3">
                {naps.map((nap, index) => (
                  <div key={index} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">Window {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => setNaps(naps.filter((_, i) => i !== index))}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={nap.startTime}
                        onChange={(e) => {
                          const next = [...naps];
                          next[index] = { ...nap, startTime: e.target.value };
                          setNaps(next);
                        }}
                        className="h-9 rounded-lg border border-border px-2 text-sm"
                      >
                        {NAP_TIME_OPTIONS.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <select
                        value={nap.endTime}
                        onChange={(e) => {
                          const next = [...naps];
                          next[index] = { ...nap, endTime: e.target.value };
                          setNaps(next);
                        }}
                        className="h-9 rounded-lg border border-border px-2 text-sm"
                      >
                        {NAP_TIME_OPTIONS.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {(["regular", "stroller"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            const next = [...naps];
                            next[index] = { ...nap, type };
                            setNaps(next);
                          }}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize ${
                            nap.type === type
                              ? "bg-primary-muted text-primary"
                              : "border border-border text-muted"
                          }`}
                        >
                          {type} nap
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {naps.length < 3 ? (
                  <button
                    type="button"
                    onClick={() => setNaps([...naps, { ...DEFAULT_NAP }])}
                    className="w-full rounded-xl border border-dashed border-border py-2 text-sm font-medium text-primary"
                  >
                    + Add window
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-muted">
                We’ll skip scheduled nap breaks and keep stops flexible.
              </p>
            )}
          </section>
        </div>
      </div>
    </WizardFrame>
  );
}

const OPTIONS = [
  {
    id: "hybrid",
    letter: "Proposed",
    title: "Current food + Option A naps (side by side)",
    summary:
      "Your current dietary chips stay as-is. Naps use Option A presets, sit in a side-by-side grid, and keep the current underline Remove control.",
    Component: OptionHybridFoodCurrentNapsA,
  },
  {
    id: "compact",
    letter: "A",
    title: "Compact inline",
    summary:
      "Diet chips in a toolbar. Nap presets (Midday / Early / Afternoon) plus one slim from–to row. Minimal card chrome.",
    Component: OptionCompactInline,
  },
  {
    id: "timeline",
    letter: "B",
    title: "Day timeline",
    summary:
      "Naps first as colored blocks on a 7a–7p strip. Food sinks to a footer with chips + free-text notes.",
    Component: OptionDayTimeline,
  },
  {
    id: "twin",
    letter: "C",
    title: "Twin panels",
    summary:
      "Full-width wizard card split into Food | Naps columns. Diet as on/off rows; naps as Schedule vs No naps.",
    Component: OptionTwinPanels,
  },
] as const;

export function FoodNapsOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Wizard · Food & naps</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Food & naps layouts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Full-width previews. The top card is the hybrid you asked for — current food, Option A naps, naps side by
          side, current Remove.
        </p>
        <p className="mt-2 text-sm text-muted">
          Current reference:{" "}
          <Link href="/design-lab/harbor/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Harbor wizard
          </Link>
          {" · "}
          production uses the Proposed hybrid (current food + Option A naps).
        </p>

        <div className="mt-10 space-y-14">
          {OPTIONS.map(({ id, letter, title, summary, Component }) => (
            <section key={id} className="scroll-mt-24">
              <div className="mb-4 max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {letter === "Proposed" ? letter : `Option ${letter}`}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{summary}</p>
              </div>
              <Component />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
