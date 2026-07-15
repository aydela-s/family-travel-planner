import { StepProps, TripPlan } from "@/types/trip-plan";
import { todayIso } from "@/lib/planning-engine/date-validation";
import { labelClassName, StepIntro } from "../shared";

const dateInputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export default function DatesStep({ formData, updateFormData }: StepProps) {
  const today = todayIso();
  const startInPast = formData.startDate !== "" && formData.startDate < today;
  const endBeforeStart =
    formData.startDate !== "" &&
    formData.endDate !== "" &&
    formData.endDate < formData.startDate;
  const endMin = formData.startDate && formData.startDate >= today ? formData.startDate : today;

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="📅"
        title="When are you traveling?"
        subtitle="Pick your first and last day on the trip — we'll build one plan for the whole stretch."
      />

      <div>
        <p className={labelClassName}>Trip dates</p>
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="tripStartDate" className="text-xs font-medium text-slate-500">
              From
            </label>
            <input
              id="tripStartDate"
              type="date"
              required
              min={today}
              value={formData.startDate}
              aria-label="Trip start"
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                const updates: Partial<TripPlan> = { startDate: value };
                if (formData.endDate && formData.endDate < value) {
                  updates.endDate = value;
                }
                updateFormData(updates);
              }}
              className={`mt-1 ${dateInputClassName}`}
            />
          </div>

          <span className="hidden shrink-0 pb-3 text-slate-300 sm:inline" aria-hidden>
            →
          </span>

          <div className="min-w-0 flex-1">
            <label htmlFor="tripEndDate" className="text-xs font-medium text-slate-500">
              To
            </label>
            <input
              id="tripEndDate"
              type="date"
              required
              min={endMin}
              value={formData.endDate}
              aria-label="Trip end"
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                updateFormData({ endDate: value });
              }}
              className={`mt-1 ${dateInputClassName}`}
            />
          </div>
        </div>

        {startInPast && (
          <p className="mt-2 text-sm font-medium text-red-600">
            Your trip can&apos;t start in the past — pick today or a future date.
          </p>
        )}
        {endBeforeStart && (
          <p className="mt-2 text-sm font-medium text-red-600">
            Your last day must be on or after your first day.
          </p>
        )}
      </div>
    </div>
  );
}
