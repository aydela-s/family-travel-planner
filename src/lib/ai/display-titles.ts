import type { ThemeId, TripBlueprint } from "@/lib/planning-engine/staged/types";
import type { Itinerary } from "@/types/itinerary";

/**
 * Deterministic user-facing day titles from internal theme ids.
 * AI polish may replace these; it must never invent POIs or rewrite the schedule.
 */
export const FALLBACK_DISPLAY_TITLES: Record<ThemeId, string> = {
  arrival: "Easy Arrival Day",
  departure: "Easy Exit Day",
  beach: "Beach & Water Day",
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
  museums: "Museums & Art Day",
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
  _blueprint: TripBlueprint | undefined | null,
): Itinerary {
  // Day theme labels ("Shopping Day", etc.) are intentionally not shown — the
  // date is enough. Keep displayTitle unset so export/PDF stay date-only too.
  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      if (!day.displayTitle) return day;
      const { displayTitle: _removed, ...rest } = day;
      return rest;
    }),
  };
}
