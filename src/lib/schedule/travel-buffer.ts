import type { TransportationType, TripPlan } from "@/types/trip-plan";

type BufferPlan = Pick<TripPlan, "transportationType" | "children">;

/**
 * Overhead around a hop that is *not* travel time: finding parking and walking
 * from it, waiting for a ride, buying tickets, car seats, strollers, and the
 * "everybody back in the car" shuffle.
 *
 * The itinerary schedules `travel time + buffer`, but only ever *reports*
 * travel time as driving/transit/walking time. Driving time ≠ family travel time.
 */
const BUFFER_BY_MODE: Record<TransportationType, number> = {
  "car-rental": 12,
  taxis: 8,
  "public-transportation": 10,
  walking: 2,
};

/** Extra minutes for wrangling the youngest traveller at both ends of a hop. */
export function childHandlingBufferMin(children: number[]): number {
  if (children.length === 0) return 0;
  const youngest = Math.min(...children);
  if (youngest <= 3) return 8;
  if (youngest <= 6) return 5;
  if (youngest <= 12) return 2;
  return 0;
}

export function familyTravelBufferMin(plan: BufferPlan): number {
  const mode = (plan.transportationType || "public-transportation") as TransportationType;
  const base = BUFFER_BY_MODE[mode] ?? BUFFER_BY_MODE["public-transportation"];
  const kids = childHandlingBufferMin(plan.children ?? []);
  // On foot there is no parking or boarding — only a light kid factor.
  return mode === "walking" ? base + Math.round(kids / 2) : base + kids;
}

/** Total minutes the timeline reserves for a hop. */
export function scheduledTravelMin(travelMin: number, plan: BufferPlan): number {
  return Math.max(0, Math.round(travelMin)) + familyTravelBufferMin(plan);
}

function bufferReason(plan: BufferPlan): string {
  const youngest = plan.children?.length ? Math.min(...plan.children) : null;
  const kidPart =
    youngest !== null && youngest <= 3
      ? "car seats and stroller"
      : youngest !== null && youngest <= 7
        ? "getting the kids in and out"
        : "getting everyone moving";
  switch (plan.transportationType) {
    case "car-rental":
      return `parking and ${kidPart}`;
    case "taxis":
      return `waiting for the ride and ${kidPart}`;
    case "public-transportation":
      return `walking to the stop, waiting, and ${kidPart}`;
    default:
      return kidPart;
  }
}

/**
 * Explains the gap between the reported travel time and the scheduled block,
 * so the extra minutes never look like inflated driving time.
 */
export function travelBufferNote(plan: BufferPlan, travelMin: number): string {
  const total = scheduledTravelMin(travelMin, plan);
  return `allow ~${total} min with ${bufferReason(plan)}`;
}
