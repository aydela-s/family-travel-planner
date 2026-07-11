import { ActivityLocation } from "@/types/itinerary";

export function buildStaticMapUrl(locations: ActivityLocation[]): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || locations.length === 0) return null;

  const path = locations.map((l) => `${l.lat},${l.lng}`).join("|");
  const markers = locations.map((l) => `color:0x0ea5e9|${l.lat},${l.lng}`).join("&markers=");
  return `https://maps.googleapis.com/maps/api/staticmap?size=640x280&scale=2&maptype=roadmap&path=color:0x0284c7ff|weight:4|${encodeURIComponent(path)}&markers=${markers}&key=${apiKey}`;
}
