"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BUDGET_STYLE_LABELS,
  getBudgetStyleLabelPlain,
  getTransportationLabel,
  getTravelStyleLabel,
  TRANSPORTATION_LABELS,
  TRAVEL_STYLE_LABELS,
} from "@/lib/format-labels";
import { formatNapsSummary } from "@/lib/planning-engine/nap-options";
import type { BudgetStyle, TravelStyle } from "@/types/trip-plan";
import { DALLAS_PLAN } from "./fixtures/dallas";

type SampleChip = {
  key: string;
  label: string;
  value: string;
  options?: { value: string; label: string }[];
};

function iconClass() {
  return "h-4 w-4 shrink-0 text-primary";
}

function PaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="currentColor" aria-hidden>
      <rect x="4" y="13" width="4" height="7" rx="1" />
      <rect x="10" y="8" width="4" height="12" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <span className={`${iconClass()} flex items-center justify-center text-[15px] font-bold leading-none`} aria-hidden>
      $
    </span>
  );
}

function StayIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="currentColor" aria-hidden>
      <path d="M12 3.2 3.5 10.2V20a1 1 0 0 0 1 1h5.2v-6.2h4.6V21H19.5a1 1 0 0 0 1-1v-9.8L12 3.2Z" />
    </svg>
  );
}

function TransitIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="currentColor" aria-hidden>
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

function NapIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="currentColor" aria-hidden>
      <path d="M13.2 3.2a8.2 8.2 0 1 0 7.6 11.4A7 7 0 0 1 13.2 3.2Z" />
    </svg>
  );
}

function InterestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="currentColor" aria-hidden>
      <path d="M12 20.2s-7-4.4-9-8.2C1.4 9.2 2.8 6.2 5.8 5.4c1.9-.5 3.7.5 4.7 1.9 1-1.4 2.8-2.4 4.7-1.9 3 .8 4.4 3.8 2.8 6.6-2 3.8-9 8.2-9 8.2Z" />
    </svg>
  );
}

function DietaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="currentColor" aria-hidden>
      <path d="M7.2 2.8h1.8v7.2A2.1 2.1 0 0 1 7 12.1V21H5.2v-8.9a2.1 2.1 0 0 1-2-2.1V2.8h1.8v5.4h.6V2.8Zm9.2 0c2.4 0 3.6 1.8 3.6 4.4V12h-1.8v9h-1.8v-9h-1.8V7.2c0-2.6 1.2-4.4 3.6-4.4Z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M12.8 3.7a1.75 1.75 0 0 1 2.48 2.47l-8.2 8.2a1.5 1.5 0 0 1-.66.38l-2.7.68a.5.5 0 0 1-.6-.6l.68-2.7c.06-.25.19-.48.38-.66l8.2-8.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11.6 4.9 15.1 8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function chipIcon(key: string): ReactNode {
  switch (key) {
    case "naps":
      return <NapIcon />;
    case "stay":
      return <StayIcon />;
    case "transportation":
      return <TransitIcon />;
    case "travelStyle":
      return <PaceIcon />;
    case "budget":
      return <BudgetIcon />;
    case "interests":
      return <InterestsIcon />;
    case "dietary":
      return <DietaryIcon />;
    default:
      return null;
  }
}

function sampleChips(): SampleChip[] {
  const plan = DALLAS_PLAN;
  const chips: SampleChip[] = [];

  if ((plan.naps?.length ?? 0) > 0) {
    chips.push({
      key: "naps",
      label: "Naps",
      value: formatNapsSummary(plan.naps),
    });
  }

  chips.push(
    {
      key: "stay",
      label: "Stay",
      value:
        plan.accommodationType === "staying_with_family_or_friends"
          ? "Family / friends"
          : "Hotel + breakfast",
    },
    {
      key: "transportation",
      label: "Transit",
      value: getTransportationLabel(plan.transportationType),
      options: (Object.keys(TRANSPORTATION_LABELS) as (keyof typeof TRANSPORTATION_LABELS)[])
        .filter((v) => v === "car-rental" || v === "taxis" || v === "public-transportation")
        .map((value) => ({ value, label: TRANSPORTATION_LABELS[value] })),
    },
    {
      key: "travelStyle",
      label: "Pace",
      value: getTravelStyleLabel(plan.travelStyle),
      options: (Object.keys(TRAVEL_STYLE_LABELS) as TravelStyle[]).map((value) => ({
        value,
        label: TRAVEL_STYLE_LABELS[value],
      })),
    },
    {
      key: "budget",
      label: "Budget",
      value: getBudgetStyleLabelPlain(plan.budgetStyle),
      options: (Object.keys(BUDGET_STYLE_LABELS) as BudgetStyle[]).map((value) => ({
        value,
        label: BUDGET_STYLE_LABELS[value].label,
      })),
    },
    {
      key: "interests",
      label: "Interests",
      value:
        plan.interests.length <= 1
          ? plan.interests[0] ?? "None"
          : `${plan.interests.length} interests`,
    },
  );

  const dietary = plan.dietaryRestrictions?.trim();
  if (dietary) {
    chips.push({ key: "dietary", label: "Dietary", value: dietary });
  }

  return chips;
}

function ItineraryHeaderFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-visible rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Dallas</h3>
          <p className="mt-1 text-sm text-muted">Aug 24–27 · 2 adults · 2 kids (3, 6)</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-ink"
        >
          Share
        </button>
      </div>
      {children}
    </div>
  );
}

/** A — Soft brand pills: primary-muted wash, always-visible edit. */
function OptionASoftBrand({ chips }: { chips: SampleChip[] }) {
  const [openKey, setOpenKey] = useState<string | null>("travelStyle");

  return (
    <ul className="flex w-full flex-wrap items-center gap-2" aria-label="Trip plan selections">
      {chips.map((chip) => {
        const open = openKey === chip.key;
        return (
          <li key={chip.key} className="relative max-w-full shrink-0">
            <div
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                open
                  ? "border-primary bg-primary-muted text-ink"
                  : "border-primary/20 bg-primary-muted/70 text-ink"
              }`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>
                {chipIcon(chip.key)}
              </span>
              <span className="min-w-0 truncate font-medium">{chip.value}</span>
              <button
                type="button"
                aria-label={`Edit ${chip.label}`}
                onClick={() => setOpenKey(open ? null : chip.key)}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${
                  open ? "bg-primary text-white" : "text-primary hover:bg-primary/10"
                }`}
              >
                <EditIcon />
              </button>
            </div>
            {open && chip.options ? (
              <div className="absolute left-0 z-20 mt-2 w-max overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)]">
                {chip.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex w-full px-2.5 py-1.5 text-left text-xs ${
                      option.label === chip.value
                        ? "font-semibold text-primary"
                        : "text-ink hover:bg-primary-muted/60"
                    }`}
                    onClick={() => setOpenKey(null)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** B — Labeled outline: category caption + value, chevron edit. */
function OptionBLabeledOutline({ chips }: { chips: SampleChip[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <ul className="flex w-full flex-wrap items-stretch gap-2" aria-label="Trip plan selections">
      {chips.map((chip) => {
        const open = openKey === chip.key;
        return (
          <li key={chip.key} className="relative max-w-full shrink-0">
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : chip.key)}
              className={`inline-flex max-w-full items-center gap-2 rounded-2xl border bg-surface px-3 py-2 text-left transition ${
                open
                  ? "border-primary ring-2 ring-primary-muted"
                  : "border-border hover:border-ink/30"
              }`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background"
                aria-hidden
              >
                {chipIcon(chip.key)}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {chip.label}
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{chip.value}</span>
              </span>
              <svg viewBox="0 0 20 20" className="ml-1 h-4 w-4 shrink-0 text-muted" fill="none" aria-hidden>
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {open && chip.options ? (
              <div className="absolute left-0 z-20 mt-2 w-max min-w-full overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)]">
                {chip.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex w-full px-2.5 py-1.5 text-left text-xs ${
                      option.label === chip.value
                        ? "font-semibold text-primary"
                        : "text-ink hover:bg-background"
                    }`}
                    onClick={() => setOpenKey(null)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function useEditableChips(initialChips: SampleChip[], initialOpen: string | null = "travelStyle") {
  const [chips, setChips] = useState(initialChips);
  const [openKey, setOpenKey] = useState<string | null>(initialOpen);

  function selectOption(chipKey: string, label: string) {
    setChips((prev) => prev.map((c) => (c.key === chipKey ? { ...c, value: label } : c)));
    setOpenKey(null);
  }

  function toggle(key: string) {
    setOpenKey((current) => (current === key ? null : key));
  }

  return { chips, openKey, openChip: chips.find((c) => c.key === openKey) ?? null, selectOption, toggle, setOpenKey };
}

function WizardHopNote({
  label,
  onClose,
  onHop,
}: {
  label: string;
  onClose: () => void;
  onHop: () => void;
}) {
  return (
    <div className="px-2.5 py-2 text-center">
      <p className="text-xs leading-relaxed text-muted">{label} opens in the wizard</p>
      <button
        type="button"
        onClick={onHop}
        className="mt-2 w-full rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white"
      >
        Open wizard step
      </button>
      <button type="button" onClick={onClose} className="mt-1 w-full py-1 text-xs text-muted hover:text-ink">
        Cancel
      </button>
    </div>
  );
}

/** Shared segmented strip — selected fill is flush (clipped by the rounded outer shell). */
function SegmentStrip({
  chips,
  openKey,
  onToggle,
  childrenFor,
}: {
  chips: SampleChip[];
  openKey: string | null;
  onToggle: (key: string) => void;
  childrenFor: (chip: SampleChip, open: boolean, isLast: boolean) => ReactNode;
}) {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border">
        <ul className="flex min-w-0 divide-x divide-border bg-background" aria-label="Trip plan selections">
          {chips.map((chip) => {
            const open = openKey === chip.key;
            return (
              <li key={chip.key} className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => onToggle(chip.key)}
                  className={`flex h-full w-full min-w-0 flex-col items-stretch gap-1 overflow-hidden px-2.5 py-2.5 text-left transition sm:px-3 ${
                    open ? "bg-primary-muted" : "bg-surface hover:bg-background"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                      {chipIcon(chip.key)}
                    </span>
                    <span className="min-w-0 truncate">{chip.label}</span>
                  </span>
                  <span
                    className={`min-w-0 truncate text-sm font-semibold ${open ? "text-primary" : "text-ink"}`}
                  >
                    {chip.value}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Menus sit outside the clipped strip so nothing is cut off. */}
      {openKey ? (
        <div
          className="relative mt-1.5 grid"
          style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}
        >
          {chips.map((chip, index) => (
            <div key={chip.key} className="relative min-w-0">
              {childrenFor(chip, openKey === chip.key, index === chips.length - 1)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** C1 — Compact list dropdown anchored under the tapped segment. */
function OptionC1Dropdown({ chips: initialChips }: { chips: SampleChip[] }) {
  const { chips, openKey, selectOption, toggle, setOpenKey } = useEditableChips(initialChips);

  return (
    <SegmentStrip
      chips={chips}
      openKey={openKey}
      onToggle={toggle}
      childrenFor={(chip, open, isLast) =>
        open ? (
          <div
            role="listbox"
            aria-label={`Change ${chip.label}`}
            className={`absolute top-0 z-30 w-max min-w-full max-w-[14rem] overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)] ${
              isLast ? "right-0" : "left-0"
            }`}
          >
            {chip.options?.length ? (
              chip.options.map((option) => {
                const selected = option.label === chip.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectOption(chip.key, option.label)}
                    className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-xs ${
                      selected ? "font-semibold text-primary" : "text-ink hover:bg-primary-muted/50"
                    }`}
                  >
                    <span>{option.label}</span>
                    {selected ? <span aria-hidden>✓</span> : null}
                  </button>
                );
              })
            ) : (
              <WizardHopNote
                label={chip.label}
                onClose={() => setOpenKey(null)}
                onHop={() => setOpenKey(null)}
              />
            )}
          </div>
        ) : null
      }
    />
  );
}

/** C2 — Floating choice pills beside/below the segment (not full width). */
function OptionC2FloatPills({ chips: initialChips }: { chips: SampleChip[] }) {
  const { chips, openKey, selectOption, toggle, setOpenKey } = useEditableChips(initialChips, "budget");

  return (
    <SegmentStrip
      chips={chips}
      openKey={openKey}
      onToggle={toggle}
      childrenFor={(chip, open, isLast) =>
        open ? (
          <div
            role="group"
            aria-label={`Change ${chip.label}`}
            className={`absolute top-0 z-30 w-max max-w-[min(18rem,calc(100vw-3rem))] rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-card)] ${
              isLast ? "right-0" : "left-1/2 -translate-x-1/2"
            }`}
          >
            {chip.options?.length ? (
              <div className="flex flex-col gap-1.5">
                {chip.options.map((option) => {
                  const selected = option.label === chip.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectOption(chip.key, option.label)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                        selected
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-background text-ink hover:border-primary/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <WizardHopNote
                label={chip.label}
                onClose={() => setOpenKey(null)}
                onHop={() => setOpenKey(null)}
              />
            )}
          </div>
        ) : null
      }
    />
  );
}

const OPTIONS = [
  {
    id: "a",
    title: "A · Soft brand pills",
    summary:
      "Light teal wash pills with icon + value and an always-visible edit control. Closest to today, but brand-colored instead of gray-cyan.",
    Preview: OptionASoftBrand,
  },
  {
    id: "b",
    title: "B · Labeled outline cards",
    summary:
      "Two-line chips: category caption + value, icon in a square badge, chevron to edit. More scannable when values look similar.",
    Preview: OptionBLabeledOutline,
  },
  {
    id: "c1",
    title: "C1 · Segment strip + dropdown (production)",
    summary:
      "Connected strip with compact list menu under the tapped segment. This is live in production.",
    Preview: OptionC1Dropdown,
  },
  {
    id: "c2",
    title: "C2 · Segment strip + floating pills",
    summary:
      "Same strip. Tapping opens a small floating stack of choice pills centered on the segment — no full-width banner.",
    Preview: OptionC2FloatPills,
  },
] as const;

export function ChipsOptionsPage() {
  const chips = sampleChips();

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-medium text-primary">Design Lab · Itinerary header</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Plan selection chips</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Ways to show editable trip choices above the itinerary. Production uses{" "}
          <span className="font-semibold text-ink">C1</span> (segment strip + dropdown).
        </p>
        <p className="mt-2 text-sm text-muted">
          <Link href="/design-lab/harbor/trip" className="font-medium text-primary underline-offset-2 hover:underline">
            Open Harbor itinerary
          </Link>
          {" · "}
          production matches C1.
        </p>

        <div className="mt-10 space-y-10">
          {OPTIONS.map((option) => (
            <article key={option.id}>
              <div className="mb-4 max-w-2xl">
                <h2 className="text-lg font-semibold text-ink">{option.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{option.summary}</p>
              </div>
              <ItineraryHeaderFrame>
                <option.Preview chips={chips} />
              </ItineraryHeaderFrame>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
