"use client";

import { useEffect, useState } from "react";
import StayAddressField from "@/components/StayAddressField";
import { AccommodationType, StepProps } from "@/types/trip-plan";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { OptionCard } from "../shared";

/** Top-level stay choice before hotel/rental detail. */
export type StayCategory = "hotel" | "rental" | "friends" | "dont_know" | "";

export function stayCategoryFromType(type: AccommodationType | ""): StayCategory {
  if (type === "hotel_breakfast_included" || type === "hotel_no_breakfast") return "hotel";
  if (type === "airbnb_with_kitchen" || type === "airbnb_no_kitchen") return "rental";
  if (type === "staying_with_family_or_friends") return "friends";
  if (type === "dont_know_yet") return "dont_know";
  return "";
}

const primaryOptions: { value: Exclude<StayCategory, "">; label: string; emoji: string }[] = [
  { value: "hotel", label: "Hotel", emoji: "🏨" },
  { value: "rental", label: "Rental", emoji: "🏠" },
  { value: "friends", label: "Family/friends", emoji: "👨‍👩‍👧" },
  { value: "dont_know", label: "Not sure yet", emoji: "🤷" },
];

const hotelSubOptions: { value: AccommodationType; label: string }[] = [
  { value: "hotel_breakfast_included", label: "Included" },
  { value: "hotel_no_breakfast", label: "Not included" },
];

const rentalSubOptions: { value: AccommodationType; label: string }[] = [
  { value: "airbnb_with_kitchen", label: "Yes" },
  { value: "airbnb_no_kitchen", label: "No" },
];

type StayFieldsProps = StepProps & {
  /** When embedded in a combined step, hide the standalone page intro. */
  embedded?: boolean;
};

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: AccommodationType; label: string }[];
  value: AccommodationType | "";
  onChange: (value: AccommodationType) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-surface p-1"
      role="group"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              selected
                ? "bg-primary text-white"
                : "text-ink hover:bg-secondary-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FoodPreferencesStep({
  formData,
  updateFormData,
  embedded = false,
}: StayFieldsProps) {
  const stayUnknown = isStayNotBookedYet(formData);
  const derived = stayCategoryFromType(formData.accommodationType);
  const [pendingCategory, setPendingCategory] = useState<StayCategory>("");

  useEffect(() => {
    if (derived) setPendingCategory("");
  }, [derived]);

  const category = derived || pendingCategory;

  function onPrimary(next: Exclude<StayCategory, "">) {
    if (next === "friends") {
      setPendingCategory("");
      updateFormData({ accommodationType: "staying_with_family_or_friends" });
      return;
    }
    if (next === "dont_know") {
      setPendingCategory("");
      updateFormData({
        accommodationType: "dont_know_yet",
        stayAddress: "",
        stayPlaceId: "",
        stayLat: null,
        stayLng: null,
      });
      return;
    }
    setPendingCategory(next);
    if (stayCategoryFromType(formData.accommodationType) !== next) {
      updateFormData({ accommodationType: "" });
    }
  }

  function onSub(type: AccommodationType) {
    setPendingCategory("");
    updateFormData({ accommodationType: type });
  }

  return (
    <div className={embedded ? "space-y-4" : "space-y-5"}>
      {!embedded && (
        <div className="space-y-2">
          <p className="text-2xl" aria-hidden>
            🏨
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Where are you staying?
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            Pick your stay type or choose “I don’t know yet” if you haven’t booked.
          </p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-ink">Stay type</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {primaryOptions.map((option) => (
            <OptionCard
              key={option.value}
              selected={category === option.value}
              label={`${option.emoji} ${option.label}`}
              onClick={() => onPrimary(option.value)}
            />
          ))}
        </div>
      </div>

      {category === "hotel" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-ink">Breakfast</span>
          <Segmented
            options={hotelSubOptions}
            value={
              formData.accommodationType === "hotel_breakfast_included" ||
              formData.accommodationType === "hotel_no_breakfast"
                ? formData.accommodationType
                : ""
            }
            onChange={onSub}
          />
        </div>
      ) : null}

      {category === "rental" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-ink">Kitchen</span>
          <Segmented
            options={rentalSubOptions}
            value={
              formData.accommodationType === "airbnb_with_kitchen" ||
              formData.accommodationType === "airbnb_no_kitchen"
                ? formData.accommodationType
                : ""
            }
            onChange={onSub}
          />
        </div>
      ) : null}

      <div>
        <p className="text-sm font-semibold text-ink">Address</p>
        <div>
          <StayAddressField
            value={formData.stayAddress ?? ""}
            destination={formData.destination}
            destinationLat={formData.destinationLat}
            destinationLng={formData.destinationLng}
            disabled={stayUnknown}
            onChange={(stayAddress) =>
              updateFormData({
                stayAddress,
                stayPlaceId: "",
                stayLat: null,
                stayLng: null,
              })
            }
            onSelect={(selection) =>
              updateFormData({
                stayAddress: selection.address,
                stayPlaceId: selection.placeId,
                stayLat: selection.lat,
                stayLng: selection.lng,
              })
            }
          />
        </div>
        {stayUnknown && (
          <p className="mt-2 text-sm text-muted">
            We’ll plan around the city center until you have a stay locked in.
          </p>
        )}
      </div>
    </div>
  );
}
