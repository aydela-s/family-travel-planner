import { formatAccommodationLabel } from "@/lib/pricing/accommodation";
import { getFamilyAgeProfile } from "@/lib/schedule/family-profile";
import { napPromptLines, wantsNoNaps, hasChildren } from "@/lib/schedule/nap-policy";
import { TripPlan, walkingLimitFromTravelStyle } from "@/types/trip-plan";
import { RawItinerary } from "@/types/itinerary";

export function getTripDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

/** @deprecated Use getTripDayCount — kept for callers */
export function getItineraryDayCount(startDate: string, endDate: string): number {
  return getTripDayCount(startDate, endDate);
}

/** Ensure raw itinerary has exactly one entry per trip day */
export function normalizeRawItinerary(raw: RawItinerary, plan: TripPlan): RawItinerary {
  const dayCount = getTripDayCount(plan.startDate, plan.endDate);
  const byDay = new Map(raw.days.map((d) => [d.day, d]));

  const days = Array.from({ length: dayCount }, (_, index) => {
    const dayNum = index + 1;
    const existing = byDay.get(dayNum);
    return existing ? { ...existing, day: dayNum } : { day: dayNum, activities: [] };
  });

  return { days };
}

export function buildItineraryPrompt(
  plan: TripPlan,
  dayCount: number,
  options?: { relaxed?: boolean; adjustDay?: number; adjustNote?: string },
): string {
  /**
   * @deprecated Phase 7 — AI recommendation layer only.
   * Structure, meals, naps, costs, and scheduling are handled by planning-engine.
   * This prompt will be replaced with slot-based attraction/restaurant selection.
   */
  const childrenSummary =
    plan.children.length > 0
      ? plan.children.map((age) => `${age} years old`).join(", ")
      : "none";

  const travelStyle = options?.relaxed ? "relaxed" : plan.travelStyle;
  const walkingLimit = options?.relaxed
    ? "low"
    : plan.walkingLimit ||
      (plan.travelStyle ? walkingLimitFromTravelStyle(plan.travelStyle) : "medium");

  const adjustmentBlock =
    options?.adjustDay && options.adjustNote
      ? `\nSPECIAL REQUEST: Rebuild Day ${options.adjustDay} with this feedback: "${options.adjustNote}". Keep other days well-paced and family-friendly.\n`
      : options?.relaxed
        ? "\nSPECIAL REQUEST: Make the entire itinerary MORE RELAXED — fewer stops, more rest, shorter walks, earlier evenings.\n"
        : "";

  const ageProfile = getFamilyAgeProfile(plan);

  return `Create a family-friendly travel itinerary for ${dayCount} day(s).${adjustmentBlock}

Trip details:
- Destination: ${plan.destination}
- Dates: ${plan.startDate} to ${plan.endDate} (${dayCount} full day(s))
- Adults: ${plan.adults}
- Children: ${childrenSummary}${plan.children.length ? ` (${ageProfile.ageSummary})` : ""}
- Travel style: ${travelStyle}
- Walking limit: ${walkingLimit}
- Transportation: ${plan.transportationType}
- Accommodation: ${formatAccommodationLabel(plan.accommodationType)}
- Dietary restrictions: ${plan.dietaryRestrictions || "none"}
${napPromptLines(plan)}- Budget per day (FAMILY TOTAL — must not exceed): $${plan.budgetPerDay} USD equivalent
- Interests: ${plan.interests.join(", ")}

Rules you MUST follow:
1. NAP RULES:${hasChildren(plan) ? (wantsNoNaps(plan) ? " User chose NO NAPS — do not schedule nap blocks or nap-related activities." : " Include rest/nap periods matching the nap preference.") : " No children — never include naps or nap-related content."}
2. SCHEDULING: Every activity must have a UNIQUE start time. Never schedule two items at the same time. Leave realistic gaps for travel between locations.
3. AGE-AWARE PLANS: Match activities to children's ages (${ageProfile.ageSummary || "adults only"}).${ageProfile.hasTeen ? " Include engaging options for teens." : ""}${ageProfile.isMixedAges ? " Balance activities for mixed ages — not only toddler activities." : ""}
4. Limit walking time based on walking limit (low = short walks, high = more walking ok).
5. Include breakfast, lunch, and dinner (or appropriate meals) each day.
6. Avoid overpacking — leave buffer time between activities.
7. TIME-OF-DAY: Morning 06:00–11:59, afternoon 12:00–17:59, evening 18:00–22:00. Titles must match the time slot.
8. CRITICAL BUDGET: Combined daily meals + transport + activities for the ENTIRE FAMILY must NEVER exceed $${plan.budgetPerDay}.
9. Generate EXACTLY ${dayCount} day objects — no more, no fewer.

Return JSON ONLY in this exact shape:
{
  "days": [
    {
      "day": 1,
      "activities": [
        { "time": "09:00", "title": "Activity name", "type": "activity", "notes": "optional tip" }
      ]
    }
  ]
}

Activity types must be one of: "activity", "meal", "rest", "nap", "travel".
Use 24-hour time format (HH:MM). Each start time must be unique within the day. Include 5–8 items per day.`;
}

export function parseItineraryResponse(content: string): RawItinerary {
  const parsed = JSON.parse(content) as RawItinerary;

  if (!parsed?.days || !Array.isArray(parsed.days)) {
    throw new Error("Invalid itinerary format: missing days array");
  }

  return parsed;
}

export function isValidTripPlan(body: unknown): body is TripPlan {
  if (!body || typeof body !== "object") return false;
  const plan = body as TripPlan;
  return (
    typeof plan.destination === "string" &&
    typeof plan.startDate === "string" &&
    typeof plan.endDate === "string" &&
    typeof plan.adults === "number" &&
    Array.isArray(plan.children) &&
    typeof plan.budgetPerDay === "number" &&
    Array.isArray(plan.interests) &&
    typeof plan.accommodationType === "string"
  );
}
