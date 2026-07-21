"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BUDGET_STYLE_LABELS,
  getAccommodationLabel,
  getBudgetStyleLabelPlain,
  getTransportationLabel,
  getTravelStyleLabel,
  TRANSPORTATION_LABELS,
  TRAVEL_STYLE_LABELS,
} from "@/lib/format-labels";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { updatesForPlanChip, type PlanChipUpdateKey } from "@/lib/plan-selection-updates";
import {
  BudgetStyle,
  TransportationType,
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
  stay: 3,
  naps: 6,
  interests: 8,
};

const READ_ONLY_KEYS = new Set<PlanChipKey>([
  "destination",
  "dates",
  "travelers",
  "dietary",
]);

/** Getting-around options shown on the itinerary (matches wizard — no walking). */
const TRANSPORT_CHIP_OPTIONS: TransportationType[] = [
  "car-rental",
  "taxis",
  "public-transportation",
];

type ChipDef = {
  key: PlanChipKey;
  label: string;
  value: string;
  editable: boolean;
  /** Inline pick list; omit to jump back to the wizard step when editable. */
  options?: { value: string; label: string }[];
};

function travelersLabel(plan: TripPlan): string {
  const adults = `${plan.adults} adult${plan.adults !== 1 ? "s" : ""}`;
  if (plan.children.length === 0) return adults;
  return `${adults}, ${plan.children.length} kid${plan.children.length !== 1 ? "s" : ""}`;
}

function stayLabel(plan: TripPlan): string {
  const type = getAccommodationLabel(plan.accommodationType);
  if (isStayNotBookedYet(plan)) return `${type} · city center`;
  const address = (plan.stayAddress ?? "").trim();
  if (!address) return type;
  const short = address.length > 36 ? `${address.slice(0, 34)}…` : address;
  return `${type} · ${short}`;
}

function interestsLabel(plan: TripPlan): string {
  if (plan.interests.length === 0) return "—";
  if (plan.interests.length <= 2) return plan.interests.join(", ");
  return `${plan.interests.slice(0, 2).join(", ")} +${plan.interests.length - 2}`;
}

function buildChips(plan: TripPlan): ChipDef[] {
  const chips: ChipDef[] = [
    {
      key: "destination",
      label: "Destination",
      value: plan.destination || "—",
      editable: false,
    },
    {
      key: "dates",
      label: "Dates",
      value:
        plan.startDate && plan.endDate ? `${plan.startDate} → ${plan.endDate}` : "—",
      editable: false,
    },
    {
      key: "travelers",
      label: "Travelers",
      value: travelersLabel(plan),
      editable: false,
    },
    {
      key: "stay",
      label: "Stay",
      value: stayLabel(plan),
      editable: true,
    },
    {
      key: "transportation",
      label: "Getting around",
      value: getTransportationLabel(plan.transportationType),
      editable: true,
      options: TRANSPORT_CHIP_OPTIONS.map((value) => ({
        value,
        label: TRANSPORTATION_LABELS[value],
      })),
    },
    {
      key: "travelStyle",
      label: "Pace",
      value: getTravelStyleLabel(plan.travelStyle),
      editable: true,
      options: (Object.keys(TRAVEL_STYLE_LABELS) as TravelStyle[]).map((value) => ({
        value,
        label: TRAVEL_STYLE_LABELS[value],
      })),
    },
  ];

  if (plan.children.length > 0) {
    chips.push({
      key: "naps",
      label: "Naps",
      value: plan.napSchedule?.trim() || "Flexible",
      editable: true,
    });
  }

  chips.push({
    key: "dietary",
    label: "Dietary",
    value: plan.dietaryRestrictions?.trim() || "None",
    editable: false,
  });

  chips.push({
    key: "budget",
    label: "Budget",
    value: getBudgetStyleLabelPlain(plan.budgetStyle),
    editable: true,
    options: (Object.keys(BUDGET_STYLE_LABELS) as BudgetStyle[]).map((value) => ({
      value,
      label: BUDGET_STYLE_LABELS[value].label,
    })),
  });

  chips.push({
    key: "interests",
    label: "Interests",
    value: interestsLabel(plan),
    editable: true,
  });

  return chips;
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a2 2 0 01-.878.507l-3 0.75a.75.75 0 01-.908-.908l.75-3a2 2 0 01.507-.878l8.5-8.5z" />
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
    <div ref={rootRef} className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your selections</p>
      <ul className="flex flex-wrap gap-2" aria-label="Trip plan selections">
        {chips.map((chip) => {
          const isOpen = openKey === chip.key;
          const canEdit = chip.editable && !disabled;

          return (
            <li key={chip.key} className="relative">
              <div
                className={`group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-ink transition ${
                  isOpen ? "border-primary/40 bg-primary-muted/50" : canEdit ? "hover:border-primary/30" : ""
                } ${disabled ? "opacity-60" : ""}`}
              >
                <span className="shrink-0 text-xs font-semibold text-muted">{chip.label}</span>
                <span className="truncate font-medium">{chip.value}</span>
                {chip.editable && (
                  <button
                    type="button"
                    disabled={!canEdit}
                    aria-expanded={chip.options ? isOpen : undefined}
                    aria-controls={chip.options ? `${listId}-${chip.key}` : undefined}
                    aria-label={`Edit ${chip.label}`}
                    onClick={() => handleEditClick(chip)}
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary transition ${
                      isOpen
                        ? "bg-primary text-white"
                        : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    } hover:bg-primary-muted disabled:cursor-not-allowed`}
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
                  className="absolute left-0 z-20 mt-2 min-w-[12rem] max-w-[18rem] overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-[var(--shadow-card)]"
                >
                  {chip.options.map((option) => {
                    const selected =
                      (chip.key === "budget" &&
                        getBudgetStyleLabelPlain(plan.budgetStyle) === option.label) ||
                      (chip.key === "travelStyle" &&
                        getTravelStyleLabel(plan.travelStyle) === option.label) ||
                      (chip.key === "transportation" &&
                        getTransportationLabel(plan.transportationType) === option.label);

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={disabled}
                        onClick={() => handleOptionSelect(chip, option.value)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-primary-muted/60 ${
                          selected ? "font-semibold text-primary" : "text-ink"
                        }`}
                      >
                        <span>{option.label}</span>
                        {selected && <span aria-hidden>✓</span>}
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
