"use client";

import TripDateRangePicker from "@/components/plan-wizard/TripDateRangePicker";
import { getTripDayCount } from "@/lib/itinerary";
import {
  MAX_TRIP_DAYS,
  todayIso,
} from "@/lib/planning-engine/date-validation";
import { tripLengthHint } from "@/lib/planning-engine/trip-date-context";
import { StepProps } from "@/types/trip-plan";
import { DynamicHint, StepIntro } from "../shared";

export default function DatesStep({ formData, updateFormData }: StepProps) {
  const today = todayIso();
  const startInPast = formData.startDate !== "" && formData.startDate < today;
  const endBeforeStart =
    formData.startDate !== "" &&
    formData.endDate !== "" &&
    formData.endDate < formData.startDate;
  const tooLong =
    formData.startDate !== "" &&
    formData.endDate !== "" &&
    !endBeforeStart &&
    !startInPast &&
    getTripDayCount(formData.startDate, formData.endDate) > MAX_TRIP_DAYS;
  const lengthHint =
    formData.startDate &&
    formData.endDate &&
    !endBeforeStart &&
    !startInPast &&
    !tooLong
      ? tripLengthHint(formData.startDate, formData.endDate)
      : null;

  return (
    <div className="space-y-6">
      <StepIntro emoji="📅" title="When are you traveling?" />

      <div className="rounded-[1.75rem] border border-border bg-surface px-5 py-3.5 shadow-[var(--shadow-card)]">
        <TripDateRangePicker
          variant="segment"
          startDate={formData.startDate}
          endDate={formData.endDate}
          onChange={(startDate, endDate) => updateFormData({ startDate, endDate })}
        />
      </div>

      {startInPast && (
        <p className="text-sm font-medium text-error">
          Your trip can&apos;t start in the past — pick today or a future date.
        </p>
      )}
      {endBeforeStart && (
        <p className="text-sm font-medium text-error">
          Your last day must be on or after your first day.
        </p>
      )}
      {tooLong && (
        <p className="text-sm font-medium text-error">
          Trips are limited to {MAX_TRIP_DAYS} days — shorten your dates to continue.
        </p>
      )}

      {lengthHint && <DynamicHint>{lengthHint}</DynamicHint>}
    </div>
  );
}
