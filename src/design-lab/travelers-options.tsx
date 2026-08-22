"use client";

import { useState } from "react";
import Link from "next/link";

const CHILD_AGES = Array.from({ length: 18 }, (_, age) => age);

function ageLabel(age: number) {
  return age === 0 ? "Under 1" : `${age} yr${age === 1 ? "" : "s"}`;
}

function resizeChildren(children: number[], count: number) {
  const next = [...children];
  while (next.length < count) next.push(0);
  while (next.length > count) next.pop();
  return next;
}

function MiniStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="inline-flex items-center rounded-full border border-border bg-surface">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-35"
        >
          −
        </button>
        <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-ink">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

function AgeSelect({
  value,
  onChange,
  id,
  compact,
}: {
  value: number;
  onChange: (age: number) => void;
  id: string;
  compact?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={
        compact
          ? "h-8 rounded-lg border border-border bg-surface px-2 text-sm text-ink"
          : "h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink"
      }
    >
      {CHILD_AGES.map((age) => (
        <option key={age} value={age}>
          {ageLabel(age)}
        </option>
      ))}
    </select>
  );
}

/** A — One toolbar row + flat age grid (no cards, no big intro). */
function OptionToolbarAges() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState<number[]>([4, 7]);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-ink">Who&apos;s coming?</h3>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-3">
        <MiniStepper label="Adults" value={adults} min={1} max={12} onChange={setAdults} />
        <MiniStepper
          label="Kids"
          value={children.length}
          min={0}
          max={10}
          onChange={(n) => setChildren(resizeChildren(children, n))}
        />
      </div>
      {children.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ages</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {children.map((age, index) => (
              <label key={index} className="flex items-center gap-2 text-sm text-ink">
                <span className="shrink-0 text-muted">Kid {index + 1}</span>
                <AgeSelect
                  compact
                  id={`toolbar-age-${index}`}
                  value={age}
                  onChange={(next) => {
                    const copy = [...children];
                    copy[index] = next;
                    setChildren(copy);
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">No kids — ages stay hidden.</p>
      )}
    </div>
  );
}

const PARTY_PRESETS = [
  { id: "2a", label: "2 adults", adults: 2, kids: 0 },
  { id: "2a1k", label: "2 + 1", adults: 2, kids: 1 },
  { id: "2a2k", label: "2 + 2", adults: 2, kids: 2 },
  { id: "1a1k", label: "1 + 1", adults: 1, kids: 1 },
  { id: "1a2k", label: "1 + 2", adults: 1, kids: 2 },
] as const;

/** B — Party-size presets first; ages only as a slim stacked list. */
function OptionPartyPresets() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState<number[]>([5, 8]);
  const [custom, setCustom] = useState(false);

  const activePreset = PARTY_PRESETS.find((p) => p.adults === adults && p.kids === children.length && !custom);

  function applyPreset(adultsNext: number, kids: number) {
    setCustom(false);
    setAdults(adultsNext);
    setChildren(resizeChildren(children, kids));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-ink">Party size</h3>
        <p className="mt-0.5 text-sm text-muted">Tap a common group, then set ages.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PARTY_PRESETS.map((preset) => {
          const selected = activePreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.adults, preset.kids)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "bg-primary text-white"
                  : "border border-border bg-surface text-ink hover:bg-secondary-muted"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            custom || !activePreset
              ? "bg-primary text-white"
              : "border border-border bg-surface text-ink hover:bg-secondary-muted"
          }`}
        >
          Custom
        </button>
      </div>

      {(custom || !activePreset) && (
        <div className="flex flex-wrap gap-4">
          <MiniStepper label="Adults" value={adults} min={1} max={12} onChange={setAdults} />
          <MiniStepper
            label="Kids"
            value={children.length}
            min={0}
            max={10}
            onChange={(n) => setChildren(resizeChildren(children, n))}
          />
        </div>
      )}

      {children.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ages</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {children.map((age, index) => (
              <label key={index} className="flex items-center gap-2 text-sm text-ink">
                <span className="shrink-0 text-muted">Kid {index + 1}</span>
                <AgeSelect
                  compact
                  id={`preset-age-${index}`}
                  value={age}
                  onChange={(next) => {
                    const copy = [...children];
                    copy[index] = next;
                    setChildren(copy);
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RosterPerson =
  | { key: string; kind: "adult" }
  | { key: string; kind: "kid"; age: number };

let rosterKey = 0;
function nextKey() {
  rosterKey += 1;
  return `p-${rosterKey}`;
}

/** C — Add/remove people roster (no count steppers). */
function OptionPeopleRoster() {
  const [people, setPeople] = useState<RosterPerson[]>([
    { key: "a1", kind: "adult" },
    { key: "a2", kind: "adult" },
    { key: "k1", kind: "kid", age: 3 },
  ]);

  const adults = people.filter((p) => p.kind === "adult").length;
  const canRemoveAdult = adults > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">Travelers</h3>
        <p className="text-xs text-muted">
          {adults} adult{adults === 1 ? "" : "s"}
          {people.some((p) => p.kind === "kid")
            ? ` · ${people.filter((p) => p.kind === "kid").length} kid${
                people.filter((p) => p.kind === "kid").length === 1 ? "" : "s"
              }`
            : ""}
        </p>
      </div>

      <ul className="space-y-1.5">
        {people.map((person) => {
          const adultN =
            person.kind === "adult"
              ? people.filter((p) => p.kind === "adult").indexOf(person) + 1
              : 0;
          const kidN =
            person.kind === "kid"
              ? people.filter((p) => p.kind === "kid").indexOf(person) + 1
              : 0;
          return (
          <li
            key={person.key}
            className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-1.5"
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                person.kind === "adult" ? "bg-primary text-white" : "bg-primary-muted text-primary"
              }`}
            >
              {person.kind === "adult" ? "A" : "K"}
            </span>
            <span className="min-w-[4.5rem] text-sm font-medium text-ink">
              {person.kind === "adult" ? `Adult ${adultN}` : `Kid ${kidN}`}
            </span>
            {person.kind === "kid" ? (
              <AgeSelect
                compact
                id={`roster-age-${person.key}`}
                value={person.age}
                onChange={(age) => {
                  setPeople((prev) =>
                    prev.map((p) => (p.key === person.key && p.kind === "kid" ? { ...p, age } : p)),
                  );
                }}
              />
            ) : (
              <span className="flex-1 text-sm text-muted">—</span>
            )}
            <button
              type="button"
              disabled={person.kind === "adult" && !canRemoveAdult}
              aria-label={`Remove ${person.kind}`}
              onClick={() => setPeople((prev) => prev.filter((p) => p.key !== person.key))}
              className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink disabled:opacity-30"
            >
              Remove
            </button>
          </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={adults >= 12}
          onClick={() => setPeople((prev) => [...prev, { key: nextKey(), kind: "adult" }])}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-secondary-muted disabled:opacity-40"
        >
          + Adult
        </button>
        <button
          type="button"
          disabled={people.filter((p) => p.kind === "kid").length >= 10}
          onClick={() => setPeople((prev) => [...prev, { key: nextKey(), kind: "kid", age: 0 }])}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-secondary-muted disabled:opacity-40"
        >
          + Kid
        </button>
      </div>
    </div>
  );
}

const OPTIONS = [
  {
    id: "toolbar",
    title: "A — Toolbar + age grid",
    summary:
      "Counts live in one slim toolbar. Ages are a flat labeled grid — no cards, no StepIntro block.",
    idea: "Compress counters; drop card chrome",
    Component: OptionToolbarAges,
  },
  {
    id: "presets",
    title: "B — Party presets",
    summary:
      "Start from common party sizes (2+2, 1+2…). Custom when needed. Ages use the compact grid from option A.",
    idea: "Skip counting for most families",
    Component: OptionPartyPresets,
  },
  {
    id: "roster",
    title: "C — People roster",
    summary:
      "No steppers. Add/remove people as rows. Kids get an age select inline; adults are just rows.",
    idea: "Roster mental model, not quantities",
    Component: OptionPeopleRoster,
  },
] as const;

export function TravelersOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Wizard · Travelers</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Compact travelers layouts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Three different ways to cut vertical space vs. today&apos;s big counter cards and per-child panels. Each
          panel is interactive — try adding kids.
        </p>
        <p className="mt-2 text-sm text-muted">
          Current reference:{" "}
          <Link href="/design-lab/harbor/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Harbor wizard
          </Link>
          {" · "}
          Harbor now uses option B presets + option A age grid.
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
