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
  naps: 4,
  interests: 5,
};

const READ_ONLY_KEYS = new Set<PlanChipKey>([
  "destination",
  "dates",
  "travelers",
  "dietary",
]);

type ChipDef = {
  key: PlanChipKey;
  label: string;
  value: string;
  editable: boolean;
  icon: ReactNode;
  /** Inline pick list; omit to jump back to the wizard step when editable. */
  options?: { value: string; label: string; disabled?: boolean }[];
};

function iconClassName(tone: "primary" | "accent" = "primary") {
  return `block h-4 w-4 shrink-0 ${tone === "accent" ? "text-accent" : "text-primary"}`;
}

/** Gauge / intensity meter — reads as travel pace better than a moon. */
function PaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="none" aria-hidden>
      <path
        d="M4 16h3.5M10 16h3.5M16 16H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5.5 16V11M12 16V8M18.5 16V5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="none" aria-hidden>
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

function StayIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="none" aria-hidden>
      <path
        d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TransitChipIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="none" aria-hidden>
      <rect x="6" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 16v3M16 16v3M6 9h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function NapChipIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="none" aria-hidden>
      <path
        d="M12 4.5A6.5 6.5 0 1 0 18.2 14.2 5.25 5.25 0 0 1 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DietaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName()} fill="none" aria-hidden>
      <path
        d="M8 3v8M8 11v10M6 3v5a2 2 0 0 0 4 0V3M16 3v7c0 1.5 1 2 2 2v9M16 3c0 3 0 5-2 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InterestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName("accent")} fill="none" aria-hidden>
      <path
        d="M12 20s-6.5-4.2-8.5-8C2 9.2 3.2 6.5 6 5.8c1.8-.4 3.5.5 4.5 1.8C11.5 6.3 13.2 5.4 15 5.8c2.8.7 4 3.4 2.5 6.2C15.5 15.8 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
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
  // Same order as wizard preference chips (Stay → Transit → Pace → Naps → Budget → Interests).
  const chips: ChipDef[] = [
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
  ];

  if (shouldShowNapSection(plan) && (plan.naps?.length ?? 0) > 0) {
    chips.push({
      key: "naps",
      label: "Naps",
      value: formatNapsSummary(plan.naps),
      editable: true,
      icon: <NapChipIcon />,
    });
  }

  const dietary = plan.dietaryRestrictions?.trim();
  if (dietary) {
    chips.push({
      key: "dietary",
      label: "Dietary",
      value: dietary,
      editable: false,
      icon: <DietaryIcon />,
    });
  }

  chips.push(
    {
      key: "budget",
      label: "Budget",
      value: getBudgetStyleLabelPlain(plan.budgetStyle),
      editable: true,
      icon: <WalletIcon />,
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

  return chips;
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

  function handleEditClick(chip: ChipDef) {
    if (disabled || !chip.editable || READ_ONLY_KEYS.has(chip.key)) return;

    if (chip.options?.length) {
      setOpenKey((current) => (current === chip.key ? null : chip.key));
      return;
    }

    const step = PLAN_CHIP_WIZARD_STEP[chip.key];
    if (step != null) onEditInWizard(step);
  }

  function handleOptionSelect(chip: ChipDef, value: string) {
    setOpenKey(null);
    onApplyUpdate(updatesForPlanChip(chip.key as PlanChipUpdateKey, value, plan));
  }

  return (
    <div ref={rootRef} className="min-w-0">
      <ul
        className="flex w-full flex-wrap items-center gap-1.5"
        aria-label="Trip plan selections"
      >
        {chips.map((chip) => {
          const isOpen = openKey === chip.key;
          const canEdit = chip.editable && !disabled;

          return (
            <li key={chip.key} className="relative max-w-full shrink-0">
              <div
                className={`group inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary-muted/40 px-2.5 py-1.5 text-xs text-ink ${
                  isOpen ? "border-secondary bg-secondary-muted" : ""
                } ${disabled ? "opacity-60" : ""}`}
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {chip.icon}
                </span>
                <span className="min-w-0 truncate leading-snug font-medium">{chip.value}</span>
                {chip.editable && (
                  <button
                    type="button"
                    disabled={!canEdit}
                    aria-expanded={chip.options ? isOpen : undefined}
                    aria-controls={chip.options ? `${listId}-${chip.key}` : undefined}
                    aria-label={`Edit ${chip.label}`}
                    onClick={() => handleEditClick(chip)}
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary transition ${
                      isOpen
                        ? "bg-accent text-white"
                        : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    } hover:bg-accent-muted hover:text-accent disabled:cursor-not-allowed`}
                  >
                    <EditIcon />
                  </button>
                )}
              </div>

              {isOpen && chip.options && (
                <div
                  id={`${listId}-${chip.key}`}
                  role="listbox"
                  aria-label={`Change ${chip.label}`}
                  className="absolute left-0 z-20 mt-2 w-max max-w-[min(12rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface py-0.5 shadow-[var(--shadow-card)]"
                >
                  {chip.options.map((option) => {
                    const selected =
                      (chip.key === "budget" &&
                        getBudgetStyleLabelPlain(plan.budgetStyle) === option.label) ||
                      (chip.key === "travelStyle" &&
                        getTravelStyleLabel(plan.travelStyle) === option.label) ||
                      (chip.key === "transportation" &&
                        getTransportationLabel(plan.transportationType) === option.label);
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
                        className={`flex w-full items-center justify-between gap-2 whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition ${
                          optionDisabled
                            ? "cursor-not-allowed text-muted opacity-60"
                            : selected
                              ? "font-semibold text-primary hover:bg-secondary-muted"
                              : "text-ink hover:bg-secondary-muted/70"
                        }`}
                      >
                        <span>
                          {option.label}
                          {option.disabled ? " (n/a)" : ""}
                        </span>
                        {selected && !option.disabled && <span aria-hidden>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
