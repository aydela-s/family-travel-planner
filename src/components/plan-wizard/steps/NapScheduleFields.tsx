"use client";

import { useEffect, useState } from "react";
import { NapEntry, NapType, StepProps } from "@/types/trip-plan";
import {
  DEFAULT_NAP_ENTRY,
  MAX_NAPS,
  NAP_TIME_OPTIONS,
  formatNapsSummary,
  shouldShowNapSection,
  validateNapsList,
} from "@/lib/planning-engine/nap-options";
import { FieldHint, inputClassName, SelectChip } from "../shared";

const NAP_PRESETS = [
  { id: "mid", label: "Midday 12–2", start: "12:00 PM", end: "2:00 PM" },
  { id: "early", label: "Early 11–1", start: "11:00 AM", end: "1:00 PM" },
  { id: "late", label: "Afternoon 1–3", start: "1:00 PM", end: "3:00 PM" },
] as const;

const NAP_TYPE_OPTIONS = [
  { value: "regular" as const, label: "Regular" },
  { value: "stroller" as const, label: "Stroller" },
];

function cloneDefaultNap(): NapEntry {
  return { ...DEFAULT_NAP_ENTRY };
}

function findActivePreset(naps: NapEntry[]) {
  if (naps.length !== 1) return undefined;
  const nap = naps[0]!;
  return NAP_PRESETS.find((preset) => preset.start === nap.startTime && preset.end === nap.endTime);
}

function NapTypePicker({
  value,
  onChange,
}: {
  value: NapType;
  onChange: (type: NapType) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-ink">Nap type</span>
        <div className="inline-flex rounded-full border border-border bg-surface p-1" role="group">
          {NAP_TYPE_OPTIONS.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  selected ? "bg-primary text-white" : "text-ink hover:bg-secondary-muted"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <FieldHint>
        {value === "stroller"
          ? "We’ll keep quiet, low-key stops during this window."
          : "We’ll skip attractions during this window."}
      </FieldHint>
    </div>
  );
}

/** Nap schedule controls — shown when youngest child is ≤ NAP_AGE_MAX. */
export default function NapScheduleFields({ formData, updateFormData }: StepProps) {
  const showNaps = shouldShowNapSection(formData);
  const naps = formData.naps ?? [];
  const activePreset = findActivePreset(naps);
  const [customMode, setCustomMode] = useState(() => naps.length > 0 && !findActivePreset(naps));
  const listError =
    showNaps && formData.naps != null && naps.length > 0 ? validateNapsList(naps) : null;

  useEffect(() => {
    if (showNaps && formData.naps == null) {
      updateFormData({ naps: [] });
    }
  }, [showNaps, formData.naps, updateFormData]);

  if (!showNaps) return null;

  function setNaps(next: NapEntry[]) {
    updateFormData({ naps: next });
  }

  function updateNap(index: number, patch: Partial<NapEntry>) {
    setCustomMode(true);
    setNaps(naps.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  }

  function setNapType(index: number, type: NapType) {
    setNaps(naps.map((n, i) => (i === index ? { ...n, type } : n)));
  }

  function addNap() {
    if (naps.length >= MAX_NAPS) return;
    setCustomMode(true);
    setNaps([...naps, cloneDefaultNap()]);
  }

  function removeNap(index: number) {
    const next = naps.filter((_, i) => i !== index);
    if (next.length === 0) {
      setCustomMode(false);
      setNaps([]);
      return;
    }
    setCustomMode(true);
    setNaps(next);
  }

  function applyPreset(start: string, end: string) {
    setCustomMode(false);
    setNaps([{ startTime: start, endTime: end, type: naps[0]?.type ?? "regular" }]);
  }

  function enterCustom() {
    setCustomMode(true);
    if (naps.length === 0) {
      setNaps([cloneDefaultNap()]);
    }
  }

  const showCustomControls = customMode || (naps.length > 0 && !activePreset);
  const showPresetDetails = Boolean(activePreset && !customMode && naps[0]);

  return (
    <div className="space-y-4 border-t border-border pt-5">
      <p className="text-sm font-semibold text-ink">Nap schedule</p>

      <div className="flex flex-wrap gap-2">
        {NAP_PRESETS.map((preset) => {
          const selected = !customMode && activePreset?.id === preset.id;
          return (
            <SelectChip
              key={preset.id}
              selected={selected}
              onClick={() => applyPreset(preset.start, preset.end)}
            >
              {preset.label}
            </SelectChip>
          );
        })}
        <SelectChip selected={showCustomControls} onClick={enterCustom}>
          Custom
        </SelectChip>
      </div>

      {showPresetDetails && naps[0] ? (
        <div className="space-y-3">
          <NapTypePicker value={naps[0].type} onChange={(type) => setNapType(0, type)} />
          {naps.length < MAX_NAPS ? (
            <button
              type="button"
              onClick={addNap}
              className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              + Add another nap
            </button>
          ) : null}
        </div>
      ) : showCustomControls ? (
        <div className="space-y-3">
          {naps.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
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

                  <NapTypePicker value={nap.type} onChange={(type) => setNapType(index, type)} />
                </div>
              ))}
            </div>
          ) : null}

          {naps.length < MAX_NAPS ? (
            <button
              type="button"
              onClick={addNap}
              className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              {naps.length === 0 ? "+ Add a nap" : "+ Add another nap"}
            </button>
          ) : null}

          {listError ? (
            <p className="rounded-2xl border border-error/20 bg-error-muted px-4 py-3 text-sm text-error">
              {listError}
            </p>
          ) : null}

          {!listError && naps.length > 0 ? (
            <p className="text-xs text-muted">{formatNapsSummary(naps)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
