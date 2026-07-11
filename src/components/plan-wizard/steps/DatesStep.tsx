import { StepProps } from "@/types/trip-plan";

import { todayIso } from "@/lib/planning-engine/date-validation";

import { DynamicHint, FieldHint, getTripLengthHint, inputClassName, labelClassName, StepIntro } from "../shared";



export default function DatesStep({ formData, updateFormData }: StepProps) {

  const tripHint = getTripLengthHint(formData);

  const today = todayIso();

  const startInPast = formData.startDate !== "" && formData.startDate < today;



  return (

    <div className="space-y-6">

      <StepIntro

        emoji="📅"

        title="When's the adventure?"

        subtitle="No pressure — even a rough window helps us plan the right pace."

      />



      <div className="grid gap-5 sm:grid-cols-2">

        <div>

          <label htmlFor="startDate" className={labelClassName}>

            Heading out

          </label>

          <input

            id="startDate"

            type="date"

            required

            min={today}

            value={formData.startDate}

            onChange={(e) => {

              const value = e.target.value;

              if (value && value < today) return;

              updateFormData({ startDate: value });

            }}

            className={inputClassName}

          />

          <FieldHint>First day of your trip — today or later.</FieldHint>

          {startInPast && (

            <p className="mt-2 text-sm font-medium text-red-600">

              Your trip can&apos;t start in the past — pick today or a future date.

            </p>

          )}

        </div>

        <div>

          <label htmlFor="endDate" className={labelClassName}>

            Coming home

          </label>

          <input

            id="endDate"

            type="date"

            required

            min={formData.startDate || today}

            value={formData.endDate}

            onChange={(e) => updateFormData({ endDate: e.target.value })}

            className={inputClassName}

          />

          <FieldHint>Last day before you head back.</FieldHint>

        </div>

      </div>



      {tripHint && <DynamicHint>{tripHint}</DynamicHint>}

    </div>

  );

}


