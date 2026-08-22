import { StepProps } from "@/types/trip-plan";
import {
  activityInterestOptions,
  dietaryQuickPicks,
  DynamicHint,
  FieldHint,
  SelectChip,
  StepIntro,
} from "../shared";

export default function ActivityInterestsStep({ formData, updateFormData }: StepProps) {
  function toggleInterest(interest: string) {
    const next = formData.interests.includes(interest)
      ? formData.interests.filter((item) => item !== interest)
      : [...formData.interests, interest];
    updateFormData({ interests: next });
  }

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
    <div className="space-y-8">
      <StepIntro emoji="❤️" title="What sounds fun to your crew?" />

      <div>
        <p className="text-sm font-semibold text-ink">Interests</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {activityInterestOptions.map(({ label, emoji }) => {
            const selected = formData.interests.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleInterest(label)}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 text-center transition ${
                  selected
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-border bg-background text-ink hover:bg-secondary-muted"
                }`}
              >
                {selected ? (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    ✓
                  </span>
                ) : null}
                <span className="text-3xl" aria-hidden>
                  {emoji}
                </span>
                <span className="text-sm font-semibold leading-snug">{label}</span>
              </button>
            );
          })}
        </div>

        {formData.interests.length > 0 && (
          <div className="mt-3">
            <DynamicHint>
              {formData.interests.length === 1
                ? `We'll build your day around ${formData.interests[0].toLowerCase()}.`
                : `Nice mix! We'll weave ${formData.interests.length} interests into a smooth flow.`}
            </DynamicHint>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-sm font-semibold text-ink">Quick dietary picks</p>
        <FieldHint>Tap anything that applies.</FieldHint>
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
    </div>
  );
}
