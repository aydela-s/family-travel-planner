import { CITY_CONFIGS, CityConfig, DEFAULT_CITY } from "@/config/city-pricing";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function detectCity(destination: string): CityConfig {
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

  return { ...DEFAULT_CITY, name: destination.split(",")[0]?.trim() || DEFAULT_CITY.name };
}
