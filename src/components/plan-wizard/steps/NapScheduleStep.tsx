"use client";

import { StepProps } from "@/types/trip-plan";
import { NO_NAPS_NEEDED } from "@/lib/planning-engine/nap-options";
import { dietaryQuickPicks, FieldHint, inputClassName, SelectChip, StepIntro } from "../shared";

export default function NapScheduleStep({ formData, updateFormData }: StepProps) {
  const noChildren = formData.children.length === 0;
  const noNaps = formData.napSchedule.trim().toLowerCase().includes("no nap");
  const freeText = noNaps ? "" : formData.napSchedule;

  function toggleDietaryPick(pick: string) {
    const current = formData.dietaryRestrictions;
    const parts = current
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const next = parts.includes(pick)
      ? parts.filter((p) => p !== pick)
      : [...parts, pick];

    updateFormData({ dietaryRestrictions: next.join(", ") });
  }

  const selectedPicks = dietaryQuickPicks.filter((pick) =>
    formData.dietaryRestrictions.toLowerCase().includes(pick.toLowerCase()),
  );

  const foodSection = (
    <div>
      <p className="text-sm font-semibold text-slate-800">Quick dietary picks</p>
      <FieldHint>Tap anything that applies.</FieldHint>
      <div className="mt-3 flex flex-wrap gap-2">
        {dietaryQuickPicks.map((pick) => (
          <SelectChip
            key={pick}
            selected={selectedPicks.includes(pick)}
            onClick={() => toggleDietaryPick(pick)}
          >
            {pick}
          </SelectChip>
        ))}
      </div>
    </div>
  );

  if (noChildren) {
    return (
      <div className="space-y-6">
        <StepIntro
          emoji="🍽️"
          title="Anything about food?"
          subtitle="Naps aren’t needed for an adults-only trip — tell us about dietary needs instead."
        />
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-600">
          You&apos;re traveling with adults only. We&apos;ll skip nap breaks and keep the pace flexible.
        </p>
        {foodSection}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="😴"
        title="Naps & food"
        subtitle="Set a nap window if you need one, plus any dietary preferences for meal planning."
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

      {foodSection}
    </div>
  );
}
