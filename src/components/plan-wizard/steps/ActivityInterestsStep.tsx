import { StepProps } from "@/types/trip-plan";
import { activityInterestOptions, DynamicHint, FieldHint, SelectChip, StepIntro } from "../shared";

export default function ActivityInterestsStep({ formData, updateFormData }: StepProps) {
  function toggleInterest(interest: string) {
    const next = formData.interests.includes(interest)
      ? formData.interests.filter((item) => item !== interest)
      : [...formData.interests, interest];
    updateFormData({ interests: next });
  }

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🎯"
        title="What sounds fun to your crew?"
        subtitle="Pick everything that gets a 'yes!' — we'll blend them into one great day."
      />

      <FieldHint>Select all that apply. The more we know, the better the plan.</FieldHint>

      <div className="flex flex-wrap gap-2">
        {activityInterestOptions.map(({ label, emoji }) => {
          const selected = formData.interests.includes(label);
          return (
            <SelectChip
              key={label}
              selected={selected}
              onClick={() => toggleInterest(label)}
            >
              {emoji} {label}
            </SelectChip>
          );
        })}
      </div>

      {formData.interests.length > 0 && (
        <DynamicHint>
          {formData.interests.length === 1
            ? `We'll build your day around ${formData.interests[0].toLowerCase()}.`
            : `Nice mix! We'll weave ${formData.interests.length} interests into a smooth flow.`}
        </DynamicHint>
      )}
    </div>
  );
}
