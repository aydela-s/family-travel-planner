import { getAccommodationLabel, getBudgetStyleLabelPlain, getTransportationLabel } from "@/lib/format-labels";
import { StepProps, TripPlan } from "@/types/trip-plan";
import { StepIntro } from "../shared";

function formatLabel(value: string) {
  if (!value) return "—";
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3.5 last:border-0 sm:flex-row sm:justify-between">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 sm:max-w-[60%] sm:text-right">{value}</dd>
    </div>
  );
}

export default function SummaryStep({ formData }: StepProps) {
  const travelers = `${formData.adults} adult${formData.adults !== 1 ? "s" : ""}${
    formData.children.length > 0
      ? `, ${formData.children.length} kid${formData.children.length !== 1 ? "s" : ""} (ages ${formData.children.join(", ")})`
      : ""
  }`;

  const sections: { label: string; value: string }[] = [
    { label: "Destination", value: formData.destination || "—" },
    {
      label: "Dates",
      value:
        formData.startDate && formData.endDate
          ? `${formData.startDate} → ${formData.endDate}`
          : "—",
    },
    { label: "Travelers", value: travelers },
    {
      label: "Travel style",
      value: `${formatLabel(formData.travelStyle)} pace`,
    },
    { label: "Getting around", value: getTransportationLabel(formData.transportationType) },
    { label: "Accommodation", value: getAccommodationLabel(formData.accommodationType) },
    { label: "Food notes", value: formData.dietaryRestrictions || "Nothing specific" },
    ...(formData.children.length > 0
      ? [{ label: "Nap schedule", value: formData.napSchedule || "Flexible" }]
      : []),
    {
      label: "Budget style",
      value: getBudgetStyleLabelPlain(formData.budgetStyle),
    },
    {
      label: "Interests",
      value: formData.interests.length > 0 ? formData.interests.join(", ") : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🎉"
        title="Looking good!"
        subtitle="Give it a quick scan — then we'll cook up your family day plan."
      />

      <dl className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 shadow-sm">
        {sections.map((section) => (
          <SummaryRow key={section.label} label={section.label} value={section.value} />
        ))}
      </dl>

      <p className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3.5 text-center text-sm leading-relaxed text-sky-800">
        Happy with everything? Hit <strong>Generate itinerary</strong> below — we&apos;ll build
        your day-by-day plan in seconds.
      </p>
    </div>
  );
}

export function validateSummary(_formData: TripPlan) {
  return true;
}
