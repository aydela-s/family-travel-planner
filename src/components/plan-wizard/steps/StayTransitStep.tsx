"use client";

import { useEffect } from "react";
import { StepProps } from "@/types/trip-plan";
import { detectCityFromPlan } from "@/lib/city-detect";
import { TRANSPORTATION_LABELS } from "@/lib/format-labels";
import {
  isPublicTransitSelectable,
  limitedTransitWarning,
  transportationOptionsForCity,
  type GettingAroundOption,
  unavailableTransitNote,
} from "@/lib/planning-engine/transit-mode";
import { OptionCard, StepIntro } from "../shared";
import FoodPreferencesStep from "./FoodPreferencesStep";

const OPTION_EMOJI: Record<GettingAroundOption, string> = {
  "car-rental": "🚗",
  taxis: "🚕",
  "public-transportation": "🚇",
};

export default function StayTransitStep({ formData, updateFormData }: StepProps) {
  const city = detectCityFromPlan(formData);
  const options = transportationOptionsForCity(city);
  const transitSelectable = isPublicTransitSelectable(city);
  const limitedWarning = limitedTransitWarning(city);
  const unavailableNote = unavailableTransitNote(city);

  useEffect(() => {
    if (formData.transportationType === "public-transportation" && !transitSelectable) {
      updateFormData({ transportationType: "" });
    }
  }, [transitSelectable, formData.transportationType, updateFormData]);

  useEffect(() => {
    if (formData.transportationType === "walking") {
      updateFormData({ transportationType: "" });
    }
  }, [formData.transportationType, updateFormData]);

  return (
    <div className="space-y-5">
      <StepIntro emoji="🏨" title="Stay & getting around" />

      <FoodPreferencesStep formData={formData} updateFormData={updateFormData} embedded />

      <div className="border-t border-border pt-5">
        <p className="text-sm font-semibold text-ink">Getting around</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {options.map((value) => {
            const isTransit = value === "public-transportation";
            const disabled = isTransit && !transitSelectable;
            return (
              <OptionCard
                key={value}
                selected={formData.transportationType === value}
                disabled={disabled}
                label={`${OPTION_EMOJI[value]} ${TRANSPORTATION_LABELS[value]}`}
                onClick={() => {
                  if (disabled) return;
                  updateFormData({ transportationType: value });
                }}
              />
            );
          })}
        </div>

        {unavailableNote && (
          <p className="mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-muted">
            {unavailableNote}
          </p>
        )}

        {limitedWarning && (
          <p className="mt-3 rounded-2xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm leading-relaxed text-ink">
            {limitedWarning}
          </p>
        )}
      </div>
    </div>
  );
}
