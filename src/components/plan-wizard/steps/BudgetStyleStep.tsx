import { BudgetStyle, StepProps } from "@/types/trip-plan";
import { OptionCard, StepIntro } from "../shared";

const budgetStyleOptions: {
  value: BudgetStyle;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    value: "save",
    emoji: "💰",
    label: "Save Money",
    description: "Free sights, bakery breakfasts, picnic lunches, casual dinners.",
  },
  {
    value: "balanced",
    emoji: "⚖️",
    label: "Balanced",
    description: "Mix of paid sights; light breakfast & lunch, one sit-down dinner.",
  },
  {
    value: "splurge",
    emoji: "✨",
    label: "Treat Ourselves",
    description: "Premium sights and restaurant meals throughout the day.",
  },
];
export default function BudgetStyleStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro
        emoji="💰"
        title="How would you like to spend on this trip?"
        subtitle="This shapes the kinds of activities and restaurants we pick — not a dollar amount."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {budgetStyleOptions.map((option) => (
          <OptionCard
            key={option.value}
            selected={formData.budgetStyle === option.value}
            label={`${option.emoji} ${option.label}`}
            description={option.description}
            onClick={() => updateFormData({ budgetStyle: option.value })}
          />
        ))}
      </div>
    </div>
  );
}
