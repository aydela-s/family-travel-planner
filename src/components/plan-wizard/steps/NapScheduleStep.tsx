"use client";

import { StepProps } from "@/types/trip-plan";
import { NO_NAPS_NEEDED } from "@/lib/planning-engine/nap-options";
import { SelectChip, StepIntro, inputClassName } from "../shared";

export default function NapScheduleStep({ formData, updateFormData }: StepProps) {
  const noChildren = formData.children.length === 0;
  const noNaps = formData.napSchedule.trim().toLowerCase().includes("no nap");
  const freeText = noNaps ? "" : formData.napSchedule;

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
        subtitle="Type a window like 12-2 PM, or skip naps entirely."
      />

      <div>
        <p className="text-sm font-semibold text-slate-800">Nap window</p>
        <input
          type="text"
          value={freeText}
          disabled={noNaps}
          placeholder="12-2 PM"
          aria-label="Nap time window"
          onChange={(e) => updateFormData({ napSchedule: e.target.value })}
          className={`mt-2 ${inputClassName} ${noNaps ? "opacity-50" : ""}`}
        />
        <p className="mt-2 text-xs text-slate-500">
          Examples: 12-2 PM, 9-11 AM, 13:00-15:00
        </p>
      </div>

      <div>
        <SelectChip
          selected={noNaps}
          onClick={() =>
            updateFormData({
              napSchedule: noNaps ? "" : NO_NAPS_NEEDED,
            })
          }
        >
          {NO_NAPS_NEEDED}
        </SelectChip>
      </div>
    </div>
  );
}
