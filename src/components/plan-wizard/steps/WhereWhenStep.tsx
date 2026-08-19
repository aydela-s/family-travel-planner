import { StepProps, TripPlan } from "@/types/trip-plan";
import DestinationAutocomplete from "@/components/DestinationAutocomplete";
import { getTripDayCount } from "@/lib/itinerary";
import {
  MAX_TRIP_DAYS,
  maxEndDateForStart,
  todayIso,
} from "@/lib/planning-engine/date-validation";
import { tripLengthHint } from "@/lib/planning-engine/trip-date-context";
import { DynamicHint, labelClassName, StepIntro } from "../shared";

const dateInputClassName =
  "w-full rounded-2xl border border-border bg-surface px-3 py-3 text-ink shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-muted";

export default function WhereWhenStep({
  formData,
  updateFormData,
  setStepBusy,
}: StepProps) {
  const today = todayIso();
  const startInPast = formData.startDate !== "" && formData.startDate < today;
  const endBeforeStart =
    formData.startDate !== "" &&
    formData.endDate !== "" &&
    formData.endDate < formData.startDate;
  const endMin = formData.startDate && formData.startDate >= today ? formData.startDate : today;
  const endMax = formData.startDate ? maxEndDateForStart(formData.startDate) : undefined;
  const tooLong =
    formData.startDate !== "" &&
    formData.endDate !== "" &&
    !endBeforeStart &&
    !startInPast &&
    getTripDayCount(formData.startDate, formData.endDate) > MAX_TRIP_DAYS;
  const lengthHint =
    formData.startDate && formData.endDate && !endBeforeStart && !startInPast && !tooLong
      ? tripLengthHint(formData.startDate, formData.endDate)
      : null;

  return (
    <div className="space-y-8">
      <StepIntro
        emoji="🌍"
        title="Where and when?"
        subtitle={`Pick a city, then your first and last day — up to ${MAX_TRIP_DAYS} days.`}
      />

      <div>
        <p className={labelClassName}>Destination</p>
        <div className="mt-2">
          <DestinationAutocomplete
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

      <div>
        <p className={labelClassName}>Trip dates</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="tripStartDate" className="text-xs font-medium text-muted">
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
                const maxEnd = maxEndDateForStart(value);
                if (formData.endDate && formData.endDate < value) {
                  updates.endDate = value;
                } else if (formData.endDate && formData.endDate > maxEnd) {
                  updates.endDate = maxEnd;
                }
                updateFormData(updates);
              }}
              className={`mt-1 ${dateInputClassName}`}
            />
          </div>

          <span className="hidden shrink-0 pb-3 text-border sm:inline" aria-hidden>
            →
          </span>

          <div className="min-w-0 flex-1">
            <label htmlFor="tripEndDate" className="text-xs font-medium text-muted">
              To
            </label>
            <input
              id="tripEndDate"
              type="date"
              required
              min={endMin}
              max={endMax}
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
          <p className="mt-2 text-sm font-medium text-error">
            Your trip can&apos;t start in the past — pick today or a future date.
          </p>
        )}
        {endBeforeStart && (
          <p className="mt-2 text-sm font-medium text-error">
            Your last day must be on or after your first day.
          </p>
        )}
        {tooLong && (
          <p className="mt-2 text-sm font-medium text-error">
            Trips are limited to {MAX_TRIP_DAYS} days — shorten your dates to continue.
          </p>
        )}
      </div>

      {lengthHint && <DynamicHint>{lengthHint}</DynamicHint>}
    </div>
  );
}
