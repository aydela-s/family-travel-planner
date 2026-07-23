import { StepProps, TransportationType } from "@/types/trip-plan";
import { TRANSPORTATION_LABELS } from "@/lib/format-labels";
import { CarIcon, TaxiIcon, TransitIcon } from "../icons";
import { DynamicHint, FieldHint, StepIntro } from "../shared";

const transportationOptions: {
  value: TransportationType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "car-rental",
    label: TRANSPORTATION_LABELS["car-rental"],
    description: "Your own wheels — farther stops OK; fuel + parking in the estimate",
    icon: <CarIcon />,
  },
  {
    value: "taxis",
    label: TRANSPORTATION_LABELS.taxis,
    description: "Door-to-door without the parking hassle",
    icon: <TaxiIcon />,
  },
  {
    value: "public-transportation",
    label: TRANSPORTATION_LABELS["public-transportation"],
    description: "Buses, trains, and metros — an adventure itself",
    icon: <TransitIcon />,
  },
];

export default function TransportationStep({ formData, updateFormData }: StepProps) {
  const selected = transportationOptions.find((o) => o.value === formData.transportationType);

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🚗"
        title="How will you get around?"
        subtitle="Pick how you'll move between stops — we'll keep routes realistic."
      />

      <FieldHint>Choose the option you&apos;ll use most days at your destination.</FieldHint>

      <div className="grid gap-3 sm:grid-cols-3">
        {transportationOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateFormData({ transportationType: option.value })}
            className={`rounded-2xl border p-5 text-left transition ${
              formData.transportationType === option.value
                ? "border-primary bg-primary-muted ring-2 ring-primary/20"
                : "border-border bg-surface hover:border-primary/30 hover:bg-primary-muted/50"
            }`}
          >
            <div
              className={`mb-3 inline-flex rounded-xl p-2.5 ${
                formData.transportationType === option.value
                  ? "bg-primary/15 text-primary"
                  : "bg-background text-muted"
              }`}
            >
              {option.icon}
            </div>
            <span className="block font-semibold text-ink">{option.label}</span>
            <p className="mt-1 text-sm leading-relaxed text-muted">{option.description}</p>
          </button>
        ))}
      </div>

      {selected && (
        <DynamicHint>
          Got it — we&apos;ll plan routes that work well with {selected.label.toLowerCase()}
          {selected.value === "car-rental"
            ? ", allow wider day distances, and include estimated parking"
            : ""}
          .
        </DynamicHint>
      )}
    </div>
  );
}
