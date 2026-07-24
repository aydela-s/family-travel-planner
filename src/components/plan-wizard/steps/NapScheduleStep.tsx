"use client";

import { useEffect } from "react";
import { NapEntry, NapType, StepProps } from "@/types/trip-plan";
import {
  DEFAULT_NAP_ENTRY,
  MAX_NAPS,
  NAP_TIME_OPTIONS,
  formatNapsSummary,
  isNoNapsSelection,
  shouldShowNapSection,
  validateNapsList,
} from "@/lib/planning-engine/nap-options";
import { dietaryQuickPicks, FieldHint, inputClassName, SelectChip, StepIntro } from "../shared";

function cloneDefaultNap(): NapEntry {
  return { ...DEFAULT_NAP_ENTRY };
}

export default function NapScheduleStep({ formData, updateFormData }: StepProps) {
  const showNaps = shouldShowNapSection(formData);
  const noNaps = isNoNapsSelection(formData.naps);
  const naps = formData.naps ?? [];
  const listError =
    showNaps && formData.naps != null && naps.length > 0 ? validateNapsList(naps) : null;

  // Seed one open nap window for young kids (never leave the step empty/unanswered).
  useEffect(() => {
    if (showNaps && formData.naps == null) {
      updateFormData({ naps: [cloneDefaultNap()] });
    }
  }, [showNaps, formData.naps, updateFormData]);

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
      <p className="text-sm font-semibold text-ink">Quick dietary picks</p>
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

  if (!showNaps) {
    return (
      <div className="space-y-6">
        <StepIntro
          emoji="🍽️"
          title="Anything about food?"
          subtitle={
            formData.children.length === 0
              ? "Naps aren’t needed for an adults-only trip — tell us about dietary needs instead."
              : "Your kids are past typical nap ages — we’ll skip nap blocks and focus on meals."
          }
        />
        <p className="rounded-2xl border border-border bg-background px-4 py-3.5 text-sm leading-relaxed text-muted">
          {formData.children.length === 0
            ? "You’re traveling with adults only. We’ll skip nap breaks and keep the pace flexible."
            : "We’ll keep the day flowing without scheduled nap windows."}
        </p>
        {foodSection}
      </div>
    );
  }

  function setNaps(next: NapEntry[] | null) {
    updateFormData({ naps: next });
  }

  function updateNap(index: number, patch: Partial<NapEntry>) {
    const next = naps.map((n, i) => (i === index ? { ...n, ...patch } : n));
    setNaps(next);
  }

  function addNap() {
    if (naps.length >= MAX_NAPS) return;
    const base = noNaps || formData.naps == null ? [] : naps;
    setNaps([...base, cloneDefaultNap()]);
  }

  function removeNap(index: number) {
    const next = naps.filter((_, i) => i !== index);
    setNaps(next);
  }

  function toggleNoNaps() {
    if (noNaps) {
      setNaps([cloneDefaultNap()]);
    } else {
      setNaps([]);
    }
  }

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="😴"
        title="Naps & food"
        subtitle="Add nap windows if you need them, plus any dietary preferences for meal planning."
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Nap schedule</p>
          <SelectChip selected={noNaps} onClick={toggleNoNaps}>
            No naps needed
          </SelectChip>
        </div>

        {!noNaps && (
          <>
            {naps.map((nap, index) => (
              <div
                key={index}
                className="space-y-3 rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Nap #{index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeNap(index)}
                    className="text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-ink">
                    Start time
                    <select
                      value={nap.startTime}
                      aria-label={`Nap ${index + 1} start time`}
                      onChange={(e) => updateNap(index, { startTime: e.target.value })}
                      className={inputClassName}
                    >
                      {NAP_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    End time
                    <select
                      value={nap.endTime}
                      aria-label={`Nap ${index + 1} end time`}
                      onChange={(e) => updateNap(index, { endTime: e.target.value })}
                      className={inputClassName}
                    >
                      {NAP_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="text-sm font-medium text-ink">Type</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        { value: "regular", label: "Regular Nap" },
                        { value: "stroller", label: "Stroller Nap" },
                      ] as const
                    ).map((opt) => (
                      <SelectChip
                        key={opt.value}
                        selected={nap.type === opt.value}
                        onClick={() => updateNap(index, { type: opt.value as NapType })}
                      >
                        {opt.label}
                      </SelectChip>
                    ))}
                  </div>
                  <FieldHint>
                    {nap.type === "stroller"
                      ? "We’ll keep quiet, low-key stops during this window — no forced return to your stay."
                      : "We’ll block stay time and skip attractions during this window."}
                  </FieldHint>
                </div>
              </div>
            ))}

            {naps.length < MAX_NAPS && (
              <button
                type="button"
                onClick={addNap}
                className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                + Add another nap
              </button>
            )}

            {listError && (
              <p className="rounded-2xl border border-error/20 bg-error-muted px-4 py-3 text-sm text-error">
                {listError}
              </p>
            )}

            {naps.length > 0 && !listError && (
              <p className="text-xs text-muted">{formatNapsSummary(naps)}</p>
            )}
          </>
        )}
      </div>

      {foodSection}
    </div>
  );
}
