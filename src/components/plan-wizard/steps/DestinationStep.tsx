import { StepProps } from "@/types/trip-plan";
import DestinationAutocomplete from "@/components/DestinationAutocomplete";
import { DynamicHint, FieldHint, StepIntro } from "../shared";

export default function DestinationStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🗺️"
        title="Where are you headed?"
        subtitle="Start typing — we'll suggest cities and normalize the name for pricing."
      />

      <div>
        <label htmlFor="destination" className="sr-only">
          Destination
        </label>
        <DestinationAutocomplete
          value={formData.destination}
          onChange={(destination) => updateFormData({ destination })}
        />
        <FieldHint>Accurate city names help us estimate local food, transport, and activity costs.</FieldHint>
      </div>

      {formData.destination && (
        <DynamicHint>
          {formData.destination} — we&apos;ll use local currency and city pricing for your plan.
        </DynamicHint>
      )}
    </div>
  );
}
