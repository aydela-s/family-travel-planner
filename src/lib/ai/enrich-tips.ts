import { generateGatewayText } from "@/lib/ai/gateway";
import { Itinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

type TipMap = Record<string, string>;

function tipKey(day: number, time: string, title: string): string {
  return `${day}|${time}|${title}`;
}

/**
 * Optional AI pass: add short family-friendly tips to activity notes.
 * Soft-fails — never blocks the deterministic itinerary.
 */
export async function enrichItineraryTipsWithAi(
  itinerary: Itinerary,
  plan: TripPlan,
): Promise<Itinerary> {
  const candidates = itinerary.days.flatMap((day) =>
    day.activities
      .filter((a) => a.type === "activity" || a.type === "meal")
      .slice(0, 4)
      .map((a) => ({
        key: tipKey(day.day, a.time, a.title),
        day: day.day,
        time: a.time,
        title: a.title,
        type: a.type,
        existingNotes: a.notes?.trim() || "",
      })),
  );

  if (candidates.length === 0) return itinerary;

  const prompt = `You help families traveling to ${itinerary.destinationCity || itinerary.destination}.
Budget style: ${plan.budgetStyle || "balanced"}. Interests: ${plan.interests.join(", ") || "general"}.
For each stop below, write ONE short tip (max 18 words) that is practical for parents with kids.
Return JSON ONLY as an object mapping each "key" to the tip string. No markdown.

Stops:
${candidates.map((c) => `- key: ${JSON.stringify(c.key)} | ${c.type} | ${c.title}`).join("\n")}`;

  const raw = await generateGatewayText(prompt);
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let tips: TipMap;
  try {
    tips = JSON.parse(jsonText) as TipMap;
  } catch {
    return itinerary;
  }

  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      activities: day.activities.map((a) => {
        const key = tipKey(day.day, a.time, a.title);
        const tip = tips[key]?.trim();
        if (!tip) return a;
        if (a.notes?.trim()) return a;
        return { ...a, notes: tip };
      }),
    })),
  };
}
