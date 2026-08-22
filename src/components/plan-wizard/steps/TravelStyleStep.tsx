import { StepProps, walkingLimitFromTravelStyle } from "@/types/trip-plan";
import { OptionCard, StepIntro } from "../shared";

const travelStyles = [
  { value: "relaxed" as const, label: "Relaxed", emoji: "🌿" },
  { value: "balanced" as const, label: "Balanced", emoji: "⚖️" },
  { value: "packed" as const, label: "Packed", emoji: "🚀" },
];

export default function TravelStyleStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-8">
      <StepIntro emoji="🎒" title="What's your family's vibe?" />

      <div className="grid gap-3 sm:grid-cols-3">
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
  );
}
