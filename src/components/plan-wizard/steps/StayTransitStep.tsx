"use client";

import { useEffect } from "react";
import { StepProps, TransportationType } from "@/types/trip-plan";
import { detectCityFromPlan } from "@/lib/city-detect";
import { TRANSPORTATION_LABELS } from "@/lib/format-labels";
import {
  isPublicTransitSelectable,
  limitedTransitWarning,
  transportationOptionsForCity,
  unavailableTransitNote,
} from "@/lib/planning-engine/transit-mode";
import { OptionCard, StepIntro } from "../shared";
import FoodPreferencesStep from "./FoodPreferencesStep";

const OPTION_EMOJI: Record<TransportationType, string> = {
  walking: "🚶",
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

  return (
    <div className="space-y-8">
      <StepIntro
        emoji="🏨"
        title="Stay & getting around"
        subtitle="Tell us where you’re based and how you’ll move between stops."
      />

      <FoodPreferencesStep formData={formData} updateFormData={updateFormData} embedded />

      <div>
        <p className="text-sm font-semibold text-ink">How will you get around?</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
