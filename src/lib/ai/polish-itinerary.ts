import { generateGatewayText } from "@/lib/ai/gateway";
import { applyFallbackDisplayTitles } from "@/lib/ai/display-titles";
import { parsePolishPayload } from "@/lib/ai/polish-schema";
import type { TripBlueprint } from "@/lib/planning-engine/staged/types";
import type { Itinerary } from "@/types/itinerary";
import type { TripPlan } from "@/types/trip-plan";

function tipKey(day: number, time: string, title: string): string {
  return `${day}|${time}|${title}`;
}

function daySummaries(itinerary: Itinerary, blueprint: TripBlueprint | undefined | null): string {
  return itinerary.days
    .map((day) => {
      const bp = blueprint?.days.find((d) => d.dayIndex === day.day);
      const stops = day.activities
        .filter((a) => a.type === "activity" || a.type === "meal")
        .map((a) => `    - key: ${JSON.stringify(tipKey(day.day, a.time, a.title))} | ${a.type} | ${a.title}`)
        .join("\n");
      return `  Day ${day.day} themeId=${bp?.theme.id ?? "unknown"} fallback=${JSON.stringify(day.displayTitle ?? "")}
${stops}`;
    })
    .join("\n");
}

function polishPrompt(
  itinerary: Itinerary,
  plan: TripPlan,
  blueprint: TripBlueprint | undefined | null,
): string {
  return `You polish wording for a family trip to ${itinerary.destinationCity || itinerary.destination}.
Budget style: ${plan.budgetStyle || "balanced"}. Interests: ${plan.interests.join(", ") || "general"}.

Rules:
- Do NOT invent places, change times, or rename activities.
- Do NOT invent day titles — leave displayTitle empty (the date is enough).
- tips: optional, max 18 words, practical for parents. Only for keys listed. No dollar amounts.

Return JSON ONLY:
{"days":[{"day":1,"tips":{"1|10:00|Explore X":"Bring water."}}]}

Days:
${daySummaries(itinerary, blueprint)}`;
}

/** Overlay schema-valid tips only. Day theme titles are intentionally not shown. */
export function applyPolishPayload(
  itinerary: Itinerary,
  payload: ReturnType<typeof parsePolishPayload>,
): Itinerary {
  if (!payload) return itinerary;
  const byDay = new Map(payload.days.map((d) => [d.day, d]));
  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      const polish = byDay.get(day.day);
      if (!polish) return day;
      const { displayTitle: _ignored, ...rest } = day;
      return {
        ...rest,
        activities: day.activities.map((a) => {
          if (a.notes?.trim()) return a;
          const tip = polish.tips?.[tipKey(day.day, a.time, a.title)]?.trim();
          if (!tip) return a;
          return { ...a, notes: tip };
        }),
      };
    }),
  };
}

/**
 * Optional AI polish after validation/enrichment.
 * Always applies deterministic theme titles first; AI may replace wording only.
 * Soft-fails — never blocks the deterministic itinerary.
 */
export async function polishItineraryWithAi(
  itinerary: Itinerary,
  plan: TripPlan,
  blueprint?: TripBlueprint | null,
): Promise<Itinerary> {
  const withTitles = applyFallbackDisplayTitles(itinerary, blueprint);
  const prompt = polishPrompt(withTitles, plan, blueprint);
  const raw = await generateGatewayText(prompt);
  return applyPolishPayload(withTitles, parsePolishPayload(raw));
}
