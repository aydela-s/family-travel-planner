import { StepProps } from "@/types/trip-plan";

import { napQuickPicks } from "@/lib/planning-engine/nap-options";

import { SelectChip, StepIntro } from "../shared";



export default function NapScheduleStep({ formData, updateFormData }: StepProps) {

  const noChildren = formData.children.length === 0;



  if (noChildren) {

    return (

      <div className="space-y-6">

        <StepIntro

          emoji="😴"

          title="Nap schedule"

          subtitle="No children selected — naps won't appear in your itinerary."

        />

        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-600">

          You&apos;re traveling with adults only. We&apos;ll skip nap breaks and keep the pace flexible.

        </p>

      </div>

    );

  }



  return (

    <div className="space-y-6">

      <StepIntro

        emoji="😴"

        title="Any nap rhythms to plan around?"

        subtitle="Pick the pattern that fits your crew — we'll follow it exactly."

      />



      <div>

        <p className="text-sm font-semibold text-slate-800">Nap preference</p>

        <div className="mt-3 flex flex-wrap gap-2">

          {napQuickPicks.map((pick) => (

            <SelectChip

              key={pick}

              selected={formData.napSchedule === pick}

              onClick={() => updateFormData({ napSchedule: pick })}

            >

              {pick}

            </SelectChip>

          ))}

        </div>

      </div>

    </div>

  );

}


