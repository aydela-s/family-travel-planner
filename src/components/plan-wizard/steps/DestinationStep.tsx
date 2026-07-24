import { StepProps } from "@/types/trip-plan";
import DestinationAutocomplete from "@/components/DestinationAutocomplete";
import { StepIntro } from "../shared";

export default function DestinationStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🌍"
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
      </div>
    </div>
  );
}
