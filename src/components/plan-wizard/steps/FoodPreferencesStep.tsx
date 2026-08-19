"use client";

import { useEffect, useState } from "react";
import StayAddressField from "@/components/StayAddressField";
import { AccommodationType, StepProps } from "@/types/trip-plan";
import { ACCOMMODATION_LABELS } from "@/lib/format-labels";
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
  { value: "friends", label: "With family or friends", emoji: "👨‍👩‍👧" },
  { value: "dont_know", label: "I don’t know yet", emoji: "🤷" },
];

const hotelSubOptions: { value: AccommodationType; label: string }[] = [
  { value: "hotel_breakfast_included", label: ACCOMMODATION_LABELS.hotel_breakfast_included },
  { value: "hotel_no_breakfast", label: ACCOMMODATION_LABELS.hotel_no_breakfast },
];

const rentalSubOptions: { value: AccommodationType; label: string }[] = [
  { value: "airbnb_with_kitchen", label: ACCOMMODATION_LABELS.airbnb_with_kitchen },
  { value: "airbnb_no_kitchen", label: ACCOMMODATION_LABELS.airbnb_no_kitchen },
];

type StayFieldsProps = StepProps & {
  /** When embedded in a combined step, hide the standalone page intro. */
  embedded?: boolean;
};

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
    <div className={embedded ? "space-y-5" : "space-y-6"}>
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

      {category === "hotel" && (
        <div>
          <p className="text-sm font-semibold text-ink">Breakfast?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {hotelSubOptions.map((option) => (
              <OptionCard
                key={option.value}
                selected={formData.accommodationType === option.value}
                label={option.label}
                onClick={() => onSub(option.value)}
              />
            ))}
          </div>
        </div>
      )}

      {category === "rental" && (
        <div>
          <p className="text-sm font-semibold text-ink">Kitchen?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {rentalSubOptions.map((option) => (
              <OptionCard
                key={option.value}
                selected={formData.accommodationType === option.value}
                label={option.label}
                onClick={() => onSub(option.value)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-ink">Stay name or address</p>
        <div className="mt-2">
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
