import { BudgetStyle, StepProps } from "@/types/trip-plan";
import { OptionCard, StepIntro } from "../shared";

const budgetStyleOptions: {
  value: BudgetStyle;
  emoji: string;
  label: string;
  bullets: string[];
}[] = [
  {
    value: "save",
    emoji: "💰",
    label: "Save Money",
    bullets: [
      "Prioritize free and low-cost activities",
      "Choose cheaper restaurants",
      "Focus on value over expensive experiences",
    ],
  },
  {
    value: "balanced",
    emoji: "⚖️",
    label: "Balanced",
    bullets: [
      "Mix free activities with paid attractions",
      "About one major paid attraction per day when it fits",
      "Mix of inexpensive and mid-range restaurants",
    ],
  },
  {
    value: "splurge",
    emoji: "✨",
    label: "Treat Ourselves",
    bullets: [
      "Prioritize the best experiences over minimizing cost",
      "Premium attractions and better restaurants are welcome",
      "Never rejected just for being expensive",
    ],
  },
];

export default function BudgetStyleStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro
        emoji="💳"
        title="How would you like to spend on this trip?"
        subtitle="This shapes the kinds of activities and restaurants we pick — not a dollar amount."
      />

      <div className="grid gap-3">
        {budgetStyleOptions.map((option) => (
          <OptionCard
            key={option.value}
            selected={formData.budgetStyle === option.value}
            label={`${option.emoji} ${option.label}`}
            description={option.bullets.join(" · ")}
            onClick={() => updateFormData({ budgetStyle: option.value })}
          />
        ))}
      </div>
    </div>
  );
}
