"use client";

import { useState } from "react";
import DestinationAutocomplete from "@/components/DestinationAutocomplete";
import TripDateRangePicker from "@/components/plan-wizard/TripDateRangePicker";
import { getTripDayCount } from "@/lib/itinerary";
import {
  MAX_TRIP_DAYS,
  todayIso,
} from "@/lib/planning-engine/date-validation";
import { tripLengthHint } from "@/lib/planning-engine/trip-date-context";
import { StepProps } from "@/types/trip-plan";
import { DynamicHint, StepIntro } from "../shared";

export default function WhereWhenStep({
  formData,
  updateFormData,
  setStepBusy,
}: StepProps) {
  const [datesOpen, setDatesOpen] = useState(false);
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
    <div className="space-y-8">
      <StepIntro emoji="🌍" title="Where and when?" />

      <div className="grid items-start gap-6 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="destination" className="block text-sm font-semibold text-ink">
            Where
          </label>
          <div className="mt-3">
            <DestinationAutocomplete
              placeholder="Search destinations"
              inputClassName="box-border h-[3.25rem] w-full rounded-2xl border border-border bg-surface px-4 text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-muted"
              value={formData.destination}
              onChange={(destination) =>
                updateFormData({
                  destination,
                  destinationPlaceId: "",
                  destinationLat: null,
                  destinationLng: null,
                })
              }
              onSelect={(selection) =>
                updateFormData({
                  destination: selection.destination,
                  destinationPlaceId: selection.placeId,
                  destinationLat: selection.lat,
                  destinationLng: selection.lng,
                })
              }
              onResolvingChange={setStepBusy}
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="block text-sm font-semibold text-ink">When</p>
          <div className="mt-3">
            <TripDateRangePicker
              startDate={formData.startDate}
              endDate={formData.endDate}
              open={datesOpen}
              onOpenChange={setDatesOpen}
              onChange={(startDate, endDate) => updateFormData({ startDate, endDate })}
            />
          </div>
        </div>
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
