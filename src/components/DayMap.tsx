import { ActivityLocation } from "@/types/itinerary";

export default function DayMap({
  locations,
  mapUrl,
  dayLabel,
}: {
  locations: ActivityLocation[];
  mapUrl: string | null;
  dayLabel: string;
}) {
  if (mapUrl) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt={`Map route for ${dayLabel}`}
          className="h-48 w-full object-cover sm:h-56"
        />
      </div>
    );
  }

  if (locations.length === 0) return null;

  const lats = locations.map((l) => l.lat);
  const lngs = locations.map((l) => l.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.02;

  function toXY(lat: number, lng: number) {
    const x = ((lng - minLng + pad) / (maxLng - minLng + pad * 2)) * 320 + 40;
    const y = ((maxLat - lat + pad) / (maxLat - minLat + pad * 2)) * 160 + 30;
    return { x, y };
  }

  const points = locations.map((l) => toXY(l.lat, l.lng));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-secondary-muted/50 p-4">
      <svg viewBox="0 0 400 220" className="h-44 w-full sm:h-52" role="img" aria-label={`Route map for ${dayLabel}`}>
        <path d={pathD} fill="none" stroke="#02BBCB" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="10" fill="#02BBCB" opacity="0.2" />
            <circle cx={p.x} cy={p.y} r="6" fill="#016D76" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" className="fill-muted text-[11px] font-bold">
              {String.fromCharCode(65 + i)}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-center text-xs text-muted">
        Route preview · A → {String.fromCharCode(65 + locations.length - 1)} ({locations.length} stops)
      </p>
    </div>
  );
}
