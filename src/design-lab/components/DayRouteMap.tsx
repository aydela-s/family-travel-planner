"use client";

import type { ActivityLocation } from "@/types/itinerary";

function placeQuery(location: ActivityLocation, city?: string) {
  const label =
    city && !location.name.toLowerCase().includes(city.toLowerCase())
      ? `${location.name}, ${city}`
      : location.name;
  return encodeURIComponent(label);
}

function embedSrc(locations: ActivityLocation[], selected?: string, city?: string) {
  const focus = selected ? locations.find((location) => location.name === selected) : undefined;
  if (focus) {
    return `https://maps.google.com/maps?q=${placeQuery(focus, city)}&z=16&output=embed`;
  }
  if (locations.length === 1) {
    return `https://maps.google.com/maps?q=${placeQuery(locations[0]!, city)}&z=15&output=embed`;
  }
  const start = placeQuery(locations[0]!, city);
  const daddr = locations
    .slice(1)
    .map((location) => placeQuery(location, city))
    .join("+to:");
  return `https://maps.google.com/maps?saddr=${start}&daddr=${daddr}&output=embed`;
}

export function DayRouteMap({
  locations,
  selected,
  label,
  city,
}: {
  locations: ActivityLocation[];
  selected?: string;
  label: string;
  city?: string;
}) {
  if (locations.length === 0) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center bg-secondary-muted text-sm text-muted">
        No mapped stops today
      </div>
    );
  }

  return (
    <iframe
      title={`Map for ${label}`}
      src={embedSrc(locations, selected, city)}
      className="h-full min-h-[22rem] w-full border-0 lg:min-h-[28rem]"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
