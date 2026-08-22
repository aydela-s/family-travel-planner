"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  BUDGET_STYLE_LABELS,
  getAccommodationLabel,
  getBudgetStyleLabelPlain,
  getTransportationLabel,
  getTravelStyleLabel,
  TRANSPORTATION_LABELS,
  TRAVEL_STYLE_LABELS,
} from "@/lib/format-labels";
import { formatNapsSummary, shouldShowNapSection } from "@/lib/planning-engine/nap-options";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { updatesForPlanChip, type PlanChipUpdateKey } from "@/lib/plan-selection-updates";
import { detectCityFromPlan } from "@/lib/city-detect";
import {
  isPublicTransitSelectable,
  transportationOptionsForCity,
} from "@/lib/planning-engine/transit-mode";
import {
  BudgetStyle,
  TravelStyle,
  TripPlan,
} from "@/types/trip-plan";

export type PlanChipKey =
  | "destination"
  | "dates"
  | "travelers"
  | "stay"
  | "transportation"
  | "travelStyle"
  | "naps"
  | "dietary"
  | "budget"
  | "interests";

/** Wizard step index for fields edited in the wizard (not inline). */
export const PLAN_CHIP_WIZARD_STEP: Partial<Record<PlanChipKey, number>> = {
  stay: 2,
  naps: 1,
  dietary: 4,
  interests: 4,
};

const READ_ONLY_KEYS = new Set<PlanChipKey>(["destination", "dates", "travelers"]);

type ChipDef = {
  key: PlanChipKey;
  label: string;
  value: string;
  editable: boolean;
  icon: ReactNode;
  /** Inline pick list; omit to jump back to the wizard step when editable. */
  options?: { value: string; label: string; disabled?: boolean }[];
};

function iconClassName() {
  return "block h-3.5 w-3.5 shrink-0 text-primary";
}

function PaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <rect x="4" y="13" width="4" height="7" rx="1" />
      <rect x="10" y="8" width="4" height="12" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
    </svg>
  );
}

function StayIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <path d="M12 3.2 3.5 10.2V20a1 1 0 0 0 1 1h5.2v-6.2h4.6V21H19.5a1 1 0 0 0 1-1v-9.8L12 3.2Z" />
    </svg>
  );
}

function TransitChipIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

function NapChipIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <path d="M13.2 3.2a8.2 8.2 0 1 0 7.6 11.4A7 7 0 0 1 13.2 3.2Z" />
    </svg>
  );
}

function DietaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <path d="M7.2 2.8h1.8v7.2A2.1 2.1 0 0 1 7 12.1V21H5.2v-8.9a2.1 2.1 0 0 1-2-2.1V2.8h1.8v5.4h.6V2.8Zm9.2 0c2.4 0 3.6 1.8 3.6 4.4V12h-1.8v9h-1.8v-9h-1.8V7.2c0-2.6 1.2-4.4 3.6-4.4Z" />
    </svg>
  );
}

function InterestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="currentColor" aria-hidden>
      <path d="M12 20.2s-7-4.4-9-8.2C1.4 9.2 2.8 6.2 5.8 5.4c1.9-.5 3.7.5 4.7 1.9 1-1.4 2.8-2.4 4.7-1.9 3 .8 4.4 3.8 2.8 6.6-2 3.8-9 8.2-9 8.2Z" />
    </svg>
  );
}

function stayLabel(plan: TripPlan): string {
  if (isStayNotBookedYet(plan) || plan.accommodationType === "dont_know_yet") {
    return "Not booked";
  }
  switch (plan.accommodationType) {
    case "hotel_breakfast_included":
      return "Hotel + breakfast";
    case "hotel_no_breakfast":
      return "Hotel";
    case "airbnb_with_kitchen":
      return "Rental + kitchen";
    case "airbnb_no_kitchen":
      return "Rental";
    case "staying_with_family_or_friends":
      return "Family / friends";
    default:
      return getAccommodationLabel(plan.accommodationType);
  }
}

function interestsLabel(plan: TripPlan): string {
  if (plan.interests.length === 0) return "None";
  if (plan.interests.length === 1) return plan.interests[0];
  return `${plan.interests.length} interests`;
}

function buildChips(plan: TripPlan): ChipDef[] {
  const city = detectCityFromPlan(plan);
  const transitSelectable = isPublicTransitSelectable(city);
  const transportOptions = transportationOptionsForCity(city);
  // Wizard order: Travelers (naps) → Stay & transit → Pace & spend → Interests (dietary).
  const chips: ChipDef[] = [];

  if (shouldShowNapSection(plan) && (plan.naps?.length ?? 0) > 0) {
    chips.push({
      key: "naps",
      label: "Naps",
      value: formatNapsSummary(plan.naps),
      editable: true,
      icon: <NapChipIcon />,
    });
  }

  chips.push(
    {
      key: "stay",
      label: "Stay",
      value: stayLabel(plan),
      editable: true,
      icon: <StayIcon />,
    },
    {
      key: "transportation",
      label: "Transit",
      value:
        plan.transportationType === "public-transportation"
          ? "Transit"
          : getTransportationLabel(plan.transportationType),
      editable: true,
      icon: <TransitChipIcon />,
      options: transportOptions.map((value) => ({
        value,
        label: TRANSPORTATION_LABELS[value],
        disabled: value === "public-transportation" && !transitSelectable,
      })),
    },
    {
      key: "travelStyle",
      label: "Pace",
      value: getTravelStyleLabel(plan.travelStyle),
      editable: true,
      icon: <PaceIcon />,
      options: (Object.keys(TRAVEL_STYLE_LABELS) as TravelStyle[]).map((value) => ({
        value,
        label: TRAVEL_STYLE_LABELS[value],
      })),
    },
    {
      key: "budget",
      label: "Budget",
      value: getBudgetStyleLabelPlain(plan.budgetStyle),
      editable: true,
      icon: <BudgetIcon />,
      options: (Object.keys(BUDGET_STYLE_LABELS) as BudgetStyle[]).map((value) => ({
        value,
        label: BUDGET_STYLE_LABELS[value].label,
      })),
    },
    {
      key: "interests",
      label: "Interests",
      value: interestsLabel(plan),
      editable: true,
      icon: <InterestsIcon />,
    },
  );

  const dietary = plan.dietaryRestrictions?.trim();
  if (dietary) {
    chips.push({
      key: "dietary",
      label: "Dietary",
      value: dietary,
      editable: true,
      icon: <DietaryIcon />,
    });
  }

  return chips;
}

function optionIsSelected(chip: ChipDef, optionLabel: string, plan: TripPlan): boolean {
  if (chip.key === "budget") return getBudgetStyleLabelPlain(plan.budgetStyle) === optionLabel;
  if (chip.key === "travelStyle") return getTravelStyleLabel(plan.travelStyle) === optionLabel;
  if (chip.key === "transportation") {
    // Option labels use TRANSPORTATION_LABELS (e.g. "Public transit"); chip value may show "Transit".
    return getTransportationLabel(plan.transportationType) === optionLabel;
  }
  return chip.value === optionLabel;
}

export default function PlanSelectionChips({
  plan,
  disabled = false,
  onApplyUpdate,
  onEditInWizard,
}: {
  plan: TripPlan;
  disabled?: boolean;
  onApplyUpdate: (updates: Partial<TripPlan>) => void;
  onEditInWizard: (stepIndex: number, updates?: Partial<TripPlan>) => void;
}) {
  const [openKey, setOpenKey] = useState<PlanChipKey | null>(null);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const chips = buildChips(plan);

  useEffect(() => {
    if (!openKey) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenKey(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenKey(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  function handleSegmentClick(chip: ChipDef) {
    if (disabled || !chip.editable || READ_ONLY_KEYS.has(chip.key)) return;
    setOpenKey((current) => (current === chip.key ? null : chip.key));
  }

  function handleOptionSelect(chip: ChipDef, value: string) {
    setOpenKey(null);
    onApplyUpdate(updatesForPlanChip(chip.key as PlanChipUpdateKey, value, plan));
  }

  function handleWizardHop(chip: ChipDef) {
    setOpenKey(null);
    const step = PLAN_CHIP_WIZARD_STEP[chip.key];
    if (step != null) onEditInWizard(step);
  }

  const openChip = openKey ? chips.find((c) => c.key === openKey) : null;

  function renderChipMenu(chip: ChipDef, panelClassName: string) {
    return (
      <div
        id={`${listId}-${chip.key}`}
        role="listbox"
        aria-label={`Change ${chip.label}`}
        className={panelClassName}
      >
        {chip.options?.length ? (
          chip.options.map((option) => {
            const selected = optionIsSelected(chip, option.label, plan);
            const optionDisabled = Boolean(disabled || option.disabled);

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={optionDisabled}
                disabled={optionDisabled}
                onClick={() => {
                  if (optionDisabled) return;
                  handleOptionSelect(chip, option.value);
                }}
                className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-xs transition ${
                  optionDisabled
                    ? "cursor-not-allowed text-muted opacity-60"
                    : selected
                      ? "font-semibold text-primary hover:bg-primary-muted/50"
                      : "text-ink hover:bg-primary-muted/50"
                }`}
              >
                <span>
                  {option.label}
                  {option.disabled ? " (n/a)" : ""}
                </span>
                {selected && !optionDisabled ? <span aria-hidden>✓</span> : null}
              </button>
            );
          })
        ) : (
          <div className="px-2.5 py-2 text-center">
            <p className="text-xs leading-relaxed text-muted">{chip.label} opens in the wizard</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleWizardHop(chip)}
              className="mt-2 w-full rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Open wizard step
            </button>
            <button
              type="button"
              onClick={() => setOpenKey(null)}
              className="mt-1 w-full py-1 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  function chipButton(chip: ChipDef, isOpen: boolean, cellClassName: string) {
    return (
      <button
        type="button"
        disabled={disabled || !chip.editable}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${listId}-${chip.key}` : undefined}
        onClick={() => handleSegmentClick(chip)}
        className={`flex h-full w-full min-w-0 flex-col items-stretch gap-1 overflow-hidden text-left transition ${cellClassName} ${
          isOpen ? "bg-primary-muted" : "bg-surface hover:bg-background"
        } disabled:cursor-not-allowed`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
            {chip.icon}
          </span>
          <span className="min-w-0 truncate">{chip.label}</span>
        </span>
        <span className={`min-w-0 truncate text-sm font-semibold ${isOpen ? "text-primary" : "text-ink"}`}>
          {chip.value}
        </span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${disabled ? "opacity-60" : ""}`}>
      {/* Mobile: 3-column grid + full-width menu below */}
      <div className="lg:hidden">
        <div className="overflow-hidden rounded-2xl border border-border">
          <ul
            className="grid grid-cols-3 divide-x divide-y divide-border bg-background"
            aria-label="Trip plan selections"
          >
            {chips.map((chip) => {
              const isOpen = openKey === chip.key;
              return (
                <li key={chip.key} className="min-w-0">
                  {chipButton(chip, isOpen, "px-2 py-2.5")}
                </li>
              );
            })}
          </ul>
        </div>
        {openChip ? (
          <div className="mt-1.5">
            {renderChipMenu(
              openChip,
              "overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)]",
            )}
          </div>
        ) : null}
      </div>

      {/* Desktop: horizontal strip + column-aligned dropdown */}
      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-2xl border border-border">
          <ul className="flex min-w-0 divide-x divide-border bg-background" aria-label="Trip plan selections">
            {chips.map((chip) => {
              const isOpen = openKey === chip.key;
              return (
                <li key={chip.key} className="min-w-0 flex-1">
                  {chipButton(chip, isOpen, "px-3 py-2.5")}
                </li>
              );
            })}
          </ul>
        </div>

        {openKey ? (
          <div
            className="absolute left-0 right-0 top-full z-30 mt-1.5 grid"
            style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}
          >
            {chips.map((chip, index) => {
              if (chip.key !== openKey) {
                return <div key={chip.key} className="min-w-0" />;
              }

              const isLast = index === chips.length - 1;

              return (
                <div key={chip.key} className="relative min-w-0">
                  {renderChipMenu(
                    chip,
                    `absolute top-0 z-30 w-max min-w-full max-w-[14rem] overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)] ${
                      isLast ? "right-0" : "left-0"
                    }`,
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
