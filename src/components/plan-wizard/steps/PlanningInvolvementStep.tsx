import type { StepProps } from "@/types/trip-plan";
import {
  applyMinimalPlanDefaults,
  clearMinimalPlanDefaults,
} from "@/lib/plan-wizard/planning-involvement";
import { OptionCard, StepIntro } from "../shared";

export default function PlanningInvolvementStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-8">
      <StepIntro
        emoji="🧭"
        title="How involved do you want to be?"
        subtitle="You can always tweak the plan after it’s generated."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          selected={formData.planningInvolvementMode === "minimal"}
          label="Just plan it for me"
          description="A few essentials — we’ll pick sensible defaults for stay, pace, budget, and interests."
          onClick={() => updateFormData(applyMinimalPlanDefaults(formData))}
        />
        <OptionCard
          selected={formData.planningInvolvementMode === "detailed"}
          label="I want more control"
          description="Answer extra preference questions so the itinerary matches how your family travels."
          onClick={() => {
            if (formData.planningInvolvementMode === "minimal") {
              updateFormData(clearMinimalPlanDefaults(formData));
            } else {
              updateFormData({ planningInvolvementMode: "detailed" });
            }
          }}
        />
      </div>
    </div>
  );
}
