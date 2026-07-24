import { StepProps, TransportationType } from "@/types/trip-plan";
import { TRANSPORTATION_LABELS } from "@/lib/format-labels";
import { OptionCard, StepIntro } from "../shared";

const transportationOptions: {
  value: TransportationType;
  label: string;
  emoji: string;
}[] = [
  {
    value: "car-rental",
    label: TRANSPORTATION_LABELS["car-rental"],
    emoji: "🚗",
  },
  {
    value: "taxis",
    label: TRANSPORTATION_LABELS.taxis,
    emoji: "🚕",
  },
  {
    value: "public-transportation",
    label: TRANSPORTATION_LABELS["public-transportation"],
    emoji: "🚇",
  },
];

export default function TransportationStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🚗"
        title="How will you get around?"
        subtitle="Pick how you'll move between stops — we'll keep routes realistic."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {transportationOptions.map((option) => (
          <OptionCard
            key={option.value}
            selected={formData.transportationType === option.value}
            label={`${option.emoji} ${option.label}`}
            onClick={() => updateFormData({ transportationType: option.value })}
          />
        ))}
      </div>
    </div>
  );
}
