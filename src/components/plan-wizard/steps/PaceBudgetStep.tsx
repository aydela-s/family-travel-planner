import { BudgetStyle, StepProps, walkingLimitFromTravelStyle } from "@/types/trip-plan";
import { BUDGET_STYLE_LABELS } from "@/lib/format-labels";
import { OptionCard, StepIntro } from "../shared";

const travelStyles = [
  { value: "relaxed" as const, label: "Relaxed", emoji: "🌿" },
  { value: "balanced" as const, label: "Balanced", emoji: "⚖️" },
  { value: "packed" as const, label: "Packed", emoji: "🚀" },
];

const budgetOrder: BudgetStyle[] = ["save", "balanced", "splurge"];

export default function PaceBudgetStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-8">
      <StepIntro
        emoji="🎒"
        title="Pace & spend"
        subtitle="Day pace shapes how full each day feels. Spending shapes the kinds of activities and restaurants we pick."
      />

      <div>
        <p className="text-sm font-semibold text-ink">Day pace</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {travelStyles.map((option) => (
            <OptionCard
              key={option.value}
              selected={formData.travelStyle === option.value}
              label={`${option.emoji} ${option.label}`}
              onClick={() =>
                updateFormData({
                  travelStyle: option.value,
                  walkingLimit: walkingLimitFromTravelStyle(option.value),
                })
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Spending</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {budgetOrder.map((value) => {
            const meta = BUDGET_STYLE_LABELS[value];
            return (
              <OptionCard
                key={value}
                selected={formData.budgetStyle === value}
                label={`${meta.emoji} ${meta.label}`}
                onClick={() => updateFormData({ budgetStyle: value })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
