import { CITY_CONFIGS, CityConfig, DEFAULT_CITY } from "@/config/city-pricing";
import { resolveDestinationBias } from "@/lib/destination-bias";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function isCuratedCityId(cityId: string): boolean {
  return CITY_CONFIGS.some((c) => c.id === cityId);
}

export type DestinationCenterOverride = {
  lat?: number | null;
  lng?: number | null;
};

function hasFiniteCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

/** True when the wizard (or API) has a Places-resolved destination center. */
export function hasResolvedDestinationCenter(plan: {
  destination?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
}): boolean {
  return (
    Boolean(plan.destination?.trim()) &&
    hasFiniteCoords(plan.destinationLat, plan.destinationLng)
  );
}

/**
 * Map destination → CityConfig.
 * Curated cities win (landmarks/pricing). For others, prefer Places-resolved
 * coords from the plan, then popular-city bias, else DEFAULT (FAM-57).
 */
export function detectCity(
  destination: string,
  center?: DestinationCenterOverride | null,
): CityConfig {
  const normalized = normalize(destination);
  if (!normalized) return DEFAULT_CITY;

  for (const city of CITY_CONFIGS) {
    if (normalized.includes(normalize(city.name))) return city;
    for (const alias of city.aliases) {
      if (normalized.includes(alias)) return city;
    }
  }

  for (const city of CITY_CONFIGS) {
    const words = normalize(city.name).split(" ");
    if (words.every((w) => normalized.includes(w))) return city;
  }

  const shortName = destination.split(",")[0]?.trim() || DEFAULT_CITY.name;
  const bias = resolveDestinationBias(destination);
  const name = bias.cityName || shortName;

  if (hasFiniteCoords(center?.lat, center?.lng)) {
    return {
      ...DEFAULT_CITY,
      name,
      lat: center!.lat as number,
      lng: center!.lng as number,
    };
  }

  if (hasFiniteCoords(bias.lat, bias.lng)) {
    return {
      ...DEFAULT_CITY,
      name,
      lat: bias.lat as number,
      lng: bias.lng as number,
    };
  }

  return {
    ...DEFAULT_CITY,
    name,
  };
}

/** detectCity using destinationLat/Lng from a trip plan when present. */
export function detectCityFromPlan(
  plan: {
    destination: string;
    destinationLat?: number | null;
    destinationLng?: number | null;
  },
): CityConfig {
  return detectCity(plan.destination, {
    lat: plan.destinationLat,
    lng: plan.destinationLng,
  });
}
