import { StepProps } from "@/types/trip-plan";
import { DynamicHint, FieldHint, OptionCard, StepIntro } from "../shared";

const budgetOptions = [
  { value: 75, label: "Budget-friendly", description: "Free parks, casual eats, smart splurges", emoji: "💵" },
  { value: 150, label: "Comfortable", description: "Mix of paid attractions and nice meals", emoji: "💳" },
  { value: 250, label: "Treat yourselves", description: "Special experiences and sit-down dining", emoji: "✨" },
  { value: 400, label: "Go big", description: "Premium picks, minimal compromise", emoji: "🌟" },
];

export default function BudgetStep({ formData, updateFormData }: StepProps) {
  const selected = budgetOptions.find((o) => o.value === formData.budgetPerDay);

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="💰"
        title="What's a comfortable daily spend?"
        subtitle="Per day, for the whole family — activities, food, and getting around."
      />

      <FieldHint>
        This is your <strong>hard daily cap</strong> for the whole family — food, transport, and
        activities combined. We&apos;ll never exceed it.
      </FieldHint>

      <div className="grid gap-3 sm:grid-cols-2">
        {budgetOptions.map((option) => (
          <OptionCard
            key={option.value}
            selected={formData.budgetPerDay === option.value}
            label={`${option.emoji} ${option.label}`}
            description={`~$${option.value}/day — ${option.description}`}
            onClick={() => updateFormData({ budgetPerDay: option.value })}
          />
        ))}
      </div>

      {selected?.value === 75 && (
        <DynamicHint>
          Plenty of amazing family days don&apos;t cost much — we&apos;ll find the good free stuff.
        </DynamicHint>
      )}
    </div>
  );
}
