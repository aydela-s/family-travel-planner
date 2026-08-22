"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { activityInterestOptions, DynamicHint, StepIntro } from "@/components/plan-wizard/shared";

type Interest = (typeof activityInterestOptions)[number];

const CATEGORIES: { id: string; title: string; labels: string[] }[] = [
  {
    id: "outdoors",
    title: "Outdoors & nature",
    labels: ["Parks & Gardens", "Nature & Scenic Views", "Swimming & Water Play", "Sports & Recreation"],
  },
  {
    id: "kids",
    title: "Kids & play",
    labels: [
      "Indoor & Outdoor Play",
      "Zoos & Aquariums",
      "Animal Experiences",
      "Theme Parks",
      "Interactive Museums",
    ],
  },
  {
    id: "culture",
    title: "Culture & learning",
    labels: ["History & Landmarks", "Museums & Art", "Tours & Sightseeing", "Shows & Entertainment"],
  },
  {
    id: "treats",
    title: "Treats & downtime",
    labels: ["Food Markets", "Shopping", "Spas"],
  },
];

function WizardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
      {children}
    </div>
  );
}

function useInterestToggle(initial: string[] = ["Zoos & Aquariums", "Parks & Gardens"]) {
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(label: string) {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  }

  return { selected, toggle, setSelected };
}

function SelectionHint({ count, first }: { count: number; first?: string }) {
  if (count === 0) return null;
  return (
    <DynamicHint>
      {count === 1
        ? `We'll build your day around ${first?.toLowerCase() ?? "that"}.`
        : `Nice mix! We'll weave ${count} interests into a smooth flow.`}
    </DynamicHint>
  );
}

/** A — Emoji tile grid: large selectable cards, not chips. */
function OptionEmojiTiles() {
  const { selected, toggle } = useInterestToggle();

  return (
    <WizardFrame>
      <div className="space-y-6">
        <StepIntro emoji="❤️" title="What sounds fun to your crew?" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {activityInterestOptions.map(({ label, emoji }) => {
            const on = selected.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 text-center transition ${
                  on
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-border bg-background text-ink hover:bg-secondary-muted"
                }`}
              >
                {on ? (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    ✓
                  </span>
                ) : null}
                <span className="text-3xl" aria-hidden>
                  {emoji}
                </span>
                <span className="text-sm font-semibold leading-snug">{label}</span>
              </button>
            );
          })}
        </div>
        <SelectionHint count={selected.length} first={selected[0]} />
      </div>
    </WizardFrame>
  );
}

/** B — Picked tray + remaining catalog (selection-first). */
function OptionPickedTray() {
  const { selected, toggle, setSelected } = useInterestToggle(["Theme Parks"]);

  const remaining = useMemo(
    () => activityInterestOptions.filter((opt) => !selected.includes(opt.label)),
    [selected],
  );

  function clearAll() {
    setSelected([]);
  }

  return (
    <WizardFrame>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Build your interest list
          </h2>
          <p className="mt-2 text-base text-muted">
            Tap to add. Your picks collect up top — reorder by removing and re-adding.
          </p>
        </div>

        <section className="rounded-2xl border border-dashed border-primary/40 bg-primary-muted/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">
              Your picks {selected.length > 0 ? `(${selected.length})` : ""}
            </p>
            {selected.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {selected.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing yet — choose from the list below.</p>
          ) : (
            <ol className="mt-3 flex flex-wrap gap-2">
              {selected.map((label, index) => {
                const opt = activityInterestOptions.find((o) => o.label === label);
                return (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => toggle(label)}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-white"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                        {index + 1}
                      </span>
                      <span aria-hidden>{opt?.emoji}</span>
                      {label}
                      <span className="opacity-80" aria-hidden>
                        ×
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-ink">Add more</p>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-background">
            {remaining.map(({ label, emoji }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => toggle(label)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-ink hover:bg-secondary-muted"
                >
                  <span className="text-xl" aria-hidden>
                    {emoji}
                  </span>
                  <span className="flex-1">{label}</span>
                  <span className="text-xs font-semibold text-primary">+ Add</span>
                </button>
              </li>
            ))}
            {remaining.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">You’ve selected everything — impressive crew.</li>
            ) : null}
          </ul>
        </section>

        <SelectionHint count={selected.length} first={selected[0]} />
      </div>
    </WizardFrame>
  );
}

/** C — Grouped categories with expandable sections. */
function OptionGroupedCategories() {
  const { selected, toggle } = useInterestToggle(["Museums & Art", "Food Markets"]);
  const [openId, setOpenId] = useState<string>("kids");

  const byLabel = useMemo(() => {
    const map = new Map<string, Interest>();
    for (const opt of activityInterestOptions) map.set(opt.label, opt);
    return map;
  }, []);

  return (
    <WizardFrame>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            What kind of days do you want?
          </h2>
          <p className="mt-2 text-base text-muted">
            Open a category, then pick interests. Selected count shows on each header.
          </p>
        </div>

        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const open = openId === cat.id;
            const count = cat.labels.filter((label) => selected.includes(label)).length;
            return (
              <div key={cat.id} className="overflow-hidden rounded-2xl border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? "" : cat.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="text-sm font-semibold text-ink">{cat.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {count > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-white">
                        {count}
                      </span>
                    ) : null}
                    <span aria-hidden>{open ? "▾" : "▸"}</span>
                  </span>
                </button>
                {open ? (
                  <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
                    {cat.labels.map((label) => {
                      const opt = byLabel.get(label);
                      if (!opt) return null;
                      const on = selected.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggle(label)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                            on
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-surface text-ink hover:bg-secondary-muted"
                          }`}
                        >
                          <span className="text-xl" aria-hidden>
                            {opt.emoji}
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {selected.length > 0 ? (
          <p className="text-sm text-muted">
            Selected:{" "}
            <span className="font-medium text-ink">{selected.join(" · ")}</span>
          </p>
        ) : null}

        <SelectionHint count={selected.length} first={selected[0]} />
      </div>
    </WizardFrame>
  );
}

const OPTIONS = [
  {
    id: "tiles",
    letter: "A",
    title: "Emoji tile grid",
    summary:
      "Large tappable cards in a grid — emoji first, checkmark when on. Feels like picking activities, not tags.",
    Component: OptionEmojiTiles,
  },
  {
    id: "tray",
    letter: "B",
    title: "Picked tray + catalog",
    summary:
      "Your selections live in a numbered tray up top. Everything else is a simple + Add list underneath.",
    Component: OptionPickedTray,
  },
  {
    id: "grouped",
    letter: "C",
    title: "Grouped categories",
    summary:
      "Accordion by theme (outdoors, kids, culture, treats). Open one section at a time; counts on each header.",
    Component: OptionGroupedCategories,
  },
] as const;

export function InterestsOptionsPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Wizard · Interests</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Interest selection layouts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Three different UIs for the final wizard step, stacked at full wizard width. Same interest list as
          production — only the chrome changes.
        </p>
        <p className="mt-2 text-sm text-muted">
          Current reference:{" "}
          <Link href="/design-lab/harbor/plan" className="font-medium text-primary underline-offset-2 hover:underline">
            Harbor wizard
          </Link>
          {" · "}
          production uses option A (emoji tile grid) plus Animal Experiences and Tours & Sightseeing.
        </p>

        <div className="mt-10 space-y-14">
          {OPTIONS.map(({ id, letter, title, summary, Component }) => (
            <section key={id} className="scroll-mt-24">
              <div className="mb-4 max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Option {letter}
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
