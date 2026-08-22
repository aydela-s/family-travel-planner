import { StepProps } from "@/types/trip-plan";
import DestinationAutocomplete from "@/components/DestinationAutocomplete";
import { StepIntro } from "../shared";

export default function DestinationStep({
  formData,
  updateFormData,
  setStepBusy,
}: StepProps) {
  return (
    <div className="space-y-6">
      <StepIntro emoji="🌍" title="Where are you headed?" />

      <div>
        <label htmlFor="destination" className="sr-only">
          Destination
        </label>
        <DestinationAutocomplete
          value={formData.destination}
          onChange={(destination) =>
            updateFormData({
              destination,
              destinationPlaceId: "",
              destinationLat: null,
              destinationLng: null,
            })
          }
          onSelect={(selection) =>
            updateFormData({
              destination: selection.destination,
              destinationPlaceId: selection.placeId,
              destinationLat: selection.lat,
              destinationLng: selection.lng,
            })
          }
          onResolvingChange={setStepBusy}
        />
      </div>
    </div>
  );
}
