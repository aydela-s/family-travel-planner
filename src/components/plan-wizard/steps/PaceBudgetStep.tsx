import {
  BudgetStyle,
  StepProps,
  TravelStyle,
  walkingLimitFromTravelStyle,
} from "@/types/trip-plan";
import { BUDGET_STYLE_LABELS } from "@/lib/format-labels";
import { StepIntro } from "../shared";

const travelStyles: { value: TravelStyle; label: string }[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];

const budgetOrder: BudgetStyle[] = ["save", "balanced", "splurge"];

const PACE_LEVEL: Record<TravelStyle, 1 | 2 | 3> = {
  relaxed: 1,
  balanced: 2,
  packed: 3,
};

const BUDGET_LEVEL: Record<BudgetStyle, 1 | 2 | 3> = {
  save: 1,
  balanced: 2,
  splurge: 3,
};

function PaceBars({ level }: { level: 1 | 2 | 3 }) {
  const heights = ["h-2.5", "h-4", "h-5"] as const;
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`w-2 rounded-sm ${heights[n - 1]} ${
            n <= level ? "bg-primary" : "bg-muted/30"
          }`}
        />
      ))}
    </span>
  );
}

function DollarMeter({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 text-base font-bold tracking-tight" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span key={n} className={n <= level ? "text-primary" : "text-muted/35"}>
          $
        </span>
      ))}
    </span>
  );
}

export default function PaceBudgetStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-8">
      <StepIntro emoji="🎒" title="Pace & spend" />

      <div className="grid grid-cols-1 gap-y-5 min-[520px]:grid-cols-2 min-[520px]:gap-x-4 min-[520px]:gap-y-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Pace</p>
          <div className="mt-2 flex justify-start gap-1.5 sm:mt-3 sm:gap-2">
            {travelStyles.map((option) => {
              const selected = formData.travelStyle === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={selected}
                  onClick={() =>
                    updateFormData({
                      travelStyle: option.value,
                      walkingLimit: walkingLimitFromTravelStyle(option.value),
                    })
                  }
                  className={`flex h-14 min-w-0 max-w-[6rem] flex-1 basis-0 flex-col items-center justify-center rounded-2xl border transition ${
                    selected
                      ? "border-primary bg-secondary-muted"
                      : "border-border bg-surface hover:border-secondary/50 hover:bg-secondary-muted/60"
                  }`}
                >
                  <PaceBars level={PACE_LEVEL[option.value]} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Spend</p>
          <div className="mt-2 flex justify-start gap-1.5 sm:mt-3 sm:gap-2">
            {budgetOrder.map((value) => {
              const selected = formData.budgetStyle === value;
              const meta = BUDGET_STYLE_LABELS[value];
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={meta.label}
                  aria-pressed={selected}
                  onClick={() => updateFormData({ budgetStyle: value })}
                  className={`flex h-14 min-w-0 max-w-[6rem] flex-1 basis-0 flex-col items-center justify-center rounded-2xl border transition ${
                    selected
                      ? "border-primary bg-secondary-muted"
                      : "border-border bg-surface hover:border-secondary/50 hover:bg-secondary-muted/60"
                  }`}
                >
                  <DollarMeter level={BUDGET_LEVEL[value]} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
