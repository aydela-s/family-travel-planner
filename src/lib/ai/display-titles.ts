import type { ThemeId, TripBlueprint } from "@/lib/planning-engine/staged/types";
import type { Itinerary } from "@/types/itinerary";

/**
 * Deterministic user-facing day titles from internal theme ids.
 * AI polish may replace these; it must never invent POIs or rewrite the schedule.
 */
export const FALLBACK_DISPLAY_TITLES: Record<ThemeId, string> = {
  arrival: "Easy Arrival Day",
  departure: "Easy Exit Day",
  beach: "Beach Day",
  play_indoor: "Indoor Play Day",
  playgrounds: "Playground Day",
  interactive: "Hands-On Discovery Day",
  animals: "Animal Adventure Day",
  entertainment: "Shows & Fun Day",
  theme_park: "Theme Park Day",
  nature: "Nature Day",
  nature_parks: "Parks & Nature Day",
  food_market: "Market Day",
  shopping: "Shopping Day",
  history: "History Day",
  scenic: "Scenic Day",
  mixed_family: "Family Mix Day",
  recovery: "Easy Pace Day",
};

const THEME_IDS = new Set<string>(Object.keys(FALLBACK_DISPLAY_TITLES));

export function isThemeId(id: string): id is ThemeId {
  return THEME_IDS.has(id);
}

export function fallbackDisplayTitle(themeId: string | undefined): string | undefined {
  if (!themeId || !isThemeId(themeId)) return undefined;
  return FALLBACK_DISPLAY_TITLES[themeId];
}

/** Stamp fallback titles from the blueprint. Does not overwrite an existing displayTitle. */
export function applyFallbackDisplayTitles(
  itinerary: Itinerary,
  blueprint: TripBlueprint | undefined | null,
): Itinerary {
  if (!blueprint) return itinerary;
  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      if (day.displayTitle?.trim()) return day;
      const bpDay = blueprint.days.find((d) => d.dayIndex === day.day);
      const title = fallbackDisplayTitle(bpDay?.theme.id);
      if (!title) return day;
      return { ...day, displayTitle: title };
    }),
  };
}
