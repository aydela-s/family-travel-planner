import { StepProps, walkingLimitFromTravelStyle } from "@/types/trip-plan";
import { DynamicHint, FieldHint, labelClassName, OptionCard, StepIntro } from "../shared";

const travelStyles = [
  { value: "relaxed" as const, label: "Relaxed", description: "Slow mornings, early evenings, room to breathe", emoji: "🌿" },
  { value: "balanced" as const, label: "Balanced", description: "A little adventure, a little downtime", emoji: "⚖️" },
  { value: "packed" as const, label: "Packed", description: "Make the most of every hour — go team!", emoji: "🚀" },
];

export default function TravelStyleStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-8">
      <StepIntro
        emoji="🎒"
        title="What's your family's vibe?"
        subtitle="No wrong answers — just pick what feels right for this trip."
      />

      <div>
        <p className={labelClassName}>How busy should the days feel?</p>
        <FieldHint>Think energy level, not guilt level.</FieldHint>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {travelStyles.map((option) => (
            <OptionCard
              key={option.value}
              selected={formData.travelStyle === option.value}
              label={`${option.emoji} ${option.label}`}
              description={option.description}
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

      {formData.travelStyle === "relaxed" && (
        <DynamicHint>
          Love it — we&apos;ll keep things mellow with plenty of breaks and nearby stops.
        </DynamicHint>
      )}
    </div>
  );
}
