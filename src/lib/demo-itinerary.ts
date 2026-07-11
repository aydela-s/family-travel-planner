/**
 * @deprecated Use planTrip from @/lib/planning-engine instead.
 * Kept for backward compatibility with demo imports.
 */
import { planTrip } from "@/lib/planning-engine";
import { TripPlan } from "@/types/trip-plan";
import { RawItinerary } from "@/types/itinerary";

export function generateDemoItinerary(
  plan: TripPlan,
  options?: {
    relaxed?: boolean;
    adjustDay?: number;
    adjustNote?: string;
    existingItinerary?: RawItinerary;
  },
): RawItinerary {
  return planTrip(plan, options).raw;
}
