"use client";

import type { ActivityLocation } from "@/types/itinerary";

export function RouteSketch({
  locations,
  selected,
  onSelect,
  height = 280,
}: {
  locations: ActivityLocation[];
  selected?: string;
  onSelect?: (name: string) => void;
  height?: number;
}) {
  if (locations.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center bg-[#d7ecee] text-sm text-[#016d76]">
        No mapped stops today
      </div>
    );
  }

  const lats = locations.map((location) => location.lat);
  const lngs = locations.map((location) => location.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.04;

  function toXY(lat: number, lng: number) {
    const x = ((lng - minLng + pad) / (maxLng - minLng + pad * 2)) * 360 + 20;
    const y = ((maxLat - lat + pad) / (maxLat - minLat + pad * 2)) * 220 + 24;
    return { x, y };
  }

  const points = locations.map((location) => ({ ...toXY(location.lat, location.lng), name: location.name }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <svg
      viewBox="0 0 400 268"
      style={{ height }}
      className="h-full w-full bg-[#d7ecee]"
      role="img"
      aria-label="Day route"
    >
      <rect width="400" height="268" fill="#d7ecee" />
      <path d="M0 70h400M0 140h400M0 210h400M80 0v268M200 0v268M320 0v268" stroke="#c5e0e3" strokeWidth="1" />
      <path d={path} fill="none" stroke="#016d76" strokeWidth="2.5" strokeDasharray="7 5" strokeLinecap="round" />
      {points.map((point, index) => {
        const active = selected === point.name;
        return (
          <g
            key={point.name}
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={() => onSelect?.(point.name)}
          >
            <circle cx={point.x} cy={point.y} r={active ? 11 : 8} fill={active ? "#ff5757" : "#016d76"} />
            <text x={point.x} y={point.y + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
