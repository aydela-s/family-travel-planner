"use client";

import { shouldShowNapSection } from "@/lib/planning-engine/nap-options";
import { StepProps } from "@/types/trip-plan";
import { useState } from "react";
import { inputClassName, SelectChip, StepIntro } from "../shared";
import NapScheduleFields from "./NapScheduleFields";

const CHILD_AGES = Array.from({ length: 18 }, (_, age) => age);

export const PARTY_PRESETS = [
  { id: "2a", label: "2 adults", adults: 2, kids: 0 },
  { id: "2a1k", label: "2 + 1", adults: 2, kids: 1 },
  { id: "2a2k", label: "2 + 2", adults: 2, kids: 2 },
  { id: "1a1k", label: "1 + 1", adults: 1, kids: 1 },
  { id: "1a2k", label: "1 + 2", adults: 1, kids: 2 },
] as const;

function ageLabel(age: number) {
  return age === 0 ? "Under 1" : `${age} yr${age === 1 ? "" : "s"}`;
}

function resizeChildren(children: number[], count: number) {
  const next = [...children];
  while (next.length < count) next.push(0);
  while (next.length > count) next.pop();
  return next;
}

function matchesPreset(adults: number, childCount: number, preset: (typeof PARTY_PRESETS)[number]) {
  return adults === preset.adults && childCount === preset.kids;
}

function findActivePreset(adults: number, childCount: number) {
  return PARTY_PRESETS.find((preset) => matchesPreset(adults, childCount, preset));
}

function MiniStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="inline-flex items-center rounded-full border border-border bg-surface">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-35"
        >
          −
        </button>
        <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-ink">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function TravelersStep({ formData, updateFormData }: StepProps) {
  const activePreset = findActivePreset(formData.adults, formData.children.length);
  const [customMode, setCustomMode] = useState(() => !activePreset);

  function applyChildren(children: number[]) {
    const wasShown = shouldShowNapSection(formData);
    const willShow = shouldShowNapSection({ children });
    updateFormData({
      children,
      ...(!willShow ? { naps: [] } : !wasShown ? { naps: [] } : {}),
    });
  }

  function handleChildCountChange(count: number) {
    setCustomMode(true);
    applyChildren(resizeChildren(formData.children, count));
  }

  function handleChildAgeChange(index: number, age: number) {
    const children = [...formData.children];
    children[index] = age;
    applyChildren(children);
  }

  function handleAdultsChange(adults: number) {
    setCustomMode(true);
    updateFormData({ adults });
  }

  function applyPreset(adults: number, kids: number) {
    setCustomMode(false);
    const children = resizeChildren(formData.children, kids);
    const wasShown = shouldShowNapSection(formData);
    const willShow = shouldShowNapSection({ children });
    updateFormData({
      adults,
      children,
      ...(!willShow ? { naps: [] } : !wasShown ? { naps: [] } : {}),
    });
  }

  const showCustomControls = customMode || !activePreset;

  return (
    <div className="space-y-5">
      <StepIntro emoji="👨‍👩‍👧‍👦" title="Who's coming along?" />

      <div className="flex flex-wrap gap-2">
        {PARTY_PRESETS.map((preset) => {
          const selected = !customMode && activePreset?.id === preset.id;
          return (
            <SelectChip
              key={preset.id}
              selected={selected}
              onClick={() => applyPreset(preset.adults, preset.kids)}
            >
              {preset.label}
            </SelectChip>
          );
        })}
        <SelectChip selected={showCustomControls} onClick={() => setCustomMode(true)}>
          Custom
        </SelectChip>
      </div>

      {showCustomControls ? (
        <div className="flex flex-wrap gap-4 border-b border-border pb-4">
          <MiniStepper
            label="Adults"
            value={formData.adults}
            min={1}
            max={12}
            onChange={handleAdultsChange}
          />
          <MiniStepper
            label="Kids"
            value={formData.children.length}
            min={0}
            max={10}
            onChange={handleChildCountChange}
          />
        </div>
      ) : null}

      {formData.children.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-ink">Ages</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {formData.children.map((age, index) => (
              <label
                key={index}
                htmlFor={`child-age-${index}`}
                className="block text-sm font-medium text-ink"
              >
                Kid {index + 1}
                <select
                  id={`child-age-${index}`}
                  value={age}
                  onChange={(event) => handleChildAgeChange(index, Number(event.target.value))}
                  className={inputClassName}
                >
                  {CHILD_AGES.map((option) => (
                    <option key={option} value={option}>
                      {ageLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <NapScheduleFields formData={formData} updateFormData={updateFormData} />
    </div>
  );
}
