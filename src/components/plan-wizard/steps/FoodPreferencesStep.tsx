import { AccommodationType, StepProps } from "@/types/trip-plan";
import { ACCOMMODATION_LABELS } from "@/lib/format-labels";
import { dietaryQuickPicks, FieldHint, inputClassName, OptionCard, OptionalLabel, SelectChip, StepIntro } from "../shared";

const accommodationOptions: {
  value: AccommodationType;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: "hotel_breakfast_included",
    label: ACCOMMODATION_LABELS.hotel_breakfast_included,
    description: "Start the day without paying for breakfast",
    emoji: "🏨",
  },
  {
    value: "hotel_no_breakfast",
    label: ACCOMMODATION_LABELS.hotel_no_breakfast,
    description: "You'll buy breakfast out each morning",
    emoji: "🛎️",
  },
  {
    value: "airbnb_with_kitchen",
    label: ACCOMMODATION_LABELS.airbnb_with_kitchen,
    description: "Cook some meals, grocery stops make sense",
    emoji: "🍳",
  },
  {
    value: "airbnb_no_kitchen",
    label: ACCOMMODATION_LABELS.airbnb_no_kitchen,
    description: "Takeaway and cafés for most meals",
    emoji: "🏠",
  },
  {
    value: "staying_with_family_or_friends",
    label: ACCOMMODATION_LABELS.staying_with_family_or_friends,
    description: "Many meals may be covered by your hosts",
    emoji: "👨‍👩‍👧",
  },
];

export default function FoodPreferencesStep({ formData, updateFormData }: StepProps) {
  function toggleDietaryPick(pick: string) {
    const current = formData.dietaryRestrictions;
    const parts = current
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const next = parts.includes(pick)
      ? parts.filter((p) => p !== pick)
      : [...parts, pick];

    updateFormData({ dietaryRestrictions: next.join(", ") });
  }

  const selectedPicks = dietaryQuickPicks.filter((pick) =>
    formData.dietaryRestrictions.toLowerCase().includes(pick.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🍕"
        title="Where are you staying — and anything about food?"
        subtitle="Your accommodation shapes meal costs and how we plan groceries vs. restaurants."
      />

      <div>
        <p className="text-sm font-semibold text-slate-800">Accommodation type</p>
        <FieldHint>This directly affects your daily food budget and meal suggestions.</FieldHint>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {accommodationOptions.map((option) => (
            <OptionCard
              key={option.value}
              selected={formData.accommodationType === option.value}
              label={`${option.emoji} ${option.label}`}
              description={option.description}
              onClick={() => updateFormData({ accommodationType: option.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">Quick dietary picks</p>
        <FieldHint>Tap anything that applies — you can add more detail below.</FieldHint>
        <div className="mt-3 flex flex-wrap gap-2">
          {dietaryQuickPicks.map((pick) => (
            <SelectChip
              key={pick}
              selected={selectedPicks.includes(pick)}
              onClick={() => toggleDietaryPick(pick)}
            >
              {pick}
            </SelectChip>
          ))}
        </div>
      </div>

      <div>
        <OptionalLabel htmlFor="dietaryRestrictions">Tell us more</OptionalLabel>
        <textarea
          id="dietaryRestrictions"
          rows={3}
          placeholder="e.g. one child only eats plain pasta, we love taco spots..."
          value={formData.dietaryRestrictions}
          onChange={(e) => updateFormData({ dietaryRestrictions: e.target.value })}
          className={inputClassName}
        />
        <FieldHint>Skip this if the quick picks cover it — totally fine.</FieldHint>
      </div>
    </div>
  );
}
