import StayAddressField from "@/components/StayAddressField";
import { AccommodationType, StepProps } from "@/types/trip-plan";
import { ACCOMMODATION_LABELS } from "@/lib/format-labels";
import { isStayNotBookedYet } from "@/lib/planning-engine/stay-home";
import { FieldHint, OptionCard, StepIntro } from "../shared";

const accommodationOptions: {
  value: AccommodationType;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: "hotel_breakfast_included",
    label: ACCOMMODATION_LABELS.hotel_breakfast_included,
    description: "Start the day without paying for breakfast",
    emoji: "🏨",
  },
  {
    value: "hotel_no_breakfast",
    label: ACCOMMODATION_LABELS.hotel_no_breakfast,
    description: "You'll buy breakfast out each morning",
    emoji: "🛎️",
  },
  {
    value: "airbnb_with_kitchen",
    label: ACCOMMODATION_LABELS.airbnb_with_kitchen,
    description: "Cook some meals, grocery stops make sense",
    emoji: "🍳",
  },
  {
    value: "airbnb_no_kitchen",
    label: ACCOMMODATION_LABELS.airbnb_no_kitchen,
    description: "Takeaway and cafés for most meals",
    emoji: "🏠",
  },
  {
    value: "staying_with_family_or_friends",
    label: ACCOMMODATION_LABELS.staying_with_family_or_friends,
    description: "Many meals may be covered by your hosts",
    emoji: "👨‍👩‍👧",
  },
  {
    value: "dont_know_yet",
    label: ACCOMMODATION_LABELS.dont_know_yet,
    description: "We’ll plan around the city center for now",
    emoji: "🤷",
  },
];

export default function FoodPreferencesStep({ formData, updateFormData }: StepProps) {
  const stayUnknown = isStayNotBookedYet(formData);

  return (
    <div className="space-y-6">
      <StepIntro
        emoji="🏨"
        title="Where are you staying?"
        subtitle="Pick your stay type and hotel or address — or choose “I don’t know yet” if you haven’t booked."
      />

      <div>
        <p className="text-sm font-semibold text-slate-800">Accommodation type</p>
        <FieldHint>This shapes meal costs and groceries vs restaurants.</FieldHint>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {accommodationOptions.map((option) => (
            <OptionCard
              key={option.value}
              selected={formData.accommodationType === option.value}
              label={`${option.emoji} ${option.label}`}
              description={option.description}
              onClick={() =>
                updateFormData(
                  option.value === "dont_know_yet"
                    ? {
                        accommodationType: option.value,
                        stayAddress: "",
                        stayPlaceId: "",
                        stayLat: null,
                        stayLng: null,
                      }
                    : { accommodationType: option.value },
                )
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">Stay name or address</p>
        <div className="mt-2">
          <StayAddressField
            value={formData.stayAddress ?? ""}
            disabled={stayUnknown}
            onChange={(stayAddress) =>
              updateFormData({
                stayAddress,
                stayPlaceId: "",
                stayLat: null,
                stayLng: null,
              })
            }
          />
        </div>
        {stayUnknown && (
          <p className="mt-2 text-sm text-slate-500">
            We’ll plan around the city center until you have a stay locked in.
          </p>
        )}
      </div>
    </div>
  );
}
