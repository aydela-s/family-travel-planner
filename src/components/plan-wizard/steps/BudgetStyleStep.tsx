import { BudgetStyle, StepProps } from "@/types/trip-plan";
import { BUDGET_STYLE_LABELS } from "@/lib/format-labels";
import { OptionCard, StepIntro } from "../shared";

const budgetOrder: BudgetStyle[] = ["save", "balanced", "splurge"];

export default function BudgetStyleStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro
        emoji="💰"
        title="How would you like to spend on this trip?"
        subtitle="This shapes the kinds of activities and restaurants we pick."
      />

      <div className="grid gap-3 sm:grid-cols-3">
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
  );
}
