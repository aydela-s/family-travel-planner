import type { RawItinerary } from "@/types/itinerary";

/** Comparable day shape for golden fixtures (titles + types only). */
export type ItineraryFingerprint = {
  days: Array<{
    day: number;
    items: Array<{ type: string; title: string }>;
  }>;
};

/** Strip clocks/notes so score-engine goldens stay stable across schedule tweaks. */
export function fingerprintRawItinerary(raw: RawItinerary): ItineraryFingerprint {
  return {
    days: raw.days.map((d) => ({
      day: d.day,
      items: d.activities.map((a) => ({ type: a.type, title: a.title })),
    })),
  };
}

/** Activity titles only — useful for variety / repeat assertions. */
export function activityTitlesByDay(raw: RawItinerary): string[][] {
  return raw.days.map((d) =>
    d.activities.filter((a) => a.type === "activity").map((a) => a.title),
  );
}
