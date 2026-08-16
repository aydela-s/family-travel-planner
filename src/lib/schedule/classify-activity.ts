import type { CityConfig, Landmark, LandmarkInterestTag } from "@/config/city-pricing";
import { isUnpaidTimelineActivity } from "@/lib/schedule/timeline";
import type { ItineraryActivity } from "@/types/itinerary";

/**
 * Name patterns for each interest category, most specific first. A venue is
 * classified by the first rule it matches, so "San Diego Zoo Safari Park" is a
 * zoo rather than a park and a children's museum is interactive, not museums.
 */
const NAME_RULES: ReadonlyArray<{ tag: LandmarkInterestTag; pattern: RegExp }> = [
  {
    tag: "theme-parks",
    pattern:
      /\b(theme\s*park|amusement\s*park|six\s*flags|legoland|disneyland|disney|universal\s*studios|sea\s*world|seaworld|water\s*park|waterpark|fun\s*plex|pier\s*rides)\b/i,
  },
  {
    tag: "zoos",
    pattern:
      /\b(zoo|aquarium|safari|wildlife|animal\s*(park|sanctuary|encounter)|butterfly\s*(house|pavilion)|petting\s*farm)\b/i,
  },
  {
    tag: "interactive",
    pattern:
      /\b(children'?s\s*museum|kids?\s*museum|discovery\s*(center|centre|museum|place)|science\s*(center|centre|museum)|exploratorium|hands[-\s]?on|maker\s*space)\b/i,
  },
  { tag: "museums", pattern: /\b(museum|gallery|art\s*(center|centre|institute)|planetarium)\b/i },
  {
    tag: "history",
    pattern:
      /\b(historic(al)?|history|heritage|fort|mission|monument|memorial|castle|cathedral|old\s*town|ruins|battlefield|lighthouse)\b/i,
  },
  {
    tag: "indoor-play",
    pattern:
      /\b(trampolin\w*|soft\s*play|indoor\s*play|play\s*cafe|bounce|urban\s*air|sky\s*zone|kids\s*empire|adventure\s*park|dino\s*kidz)\b/i,
  },
  { tag: "playgrounds", pattern: /\b(playground|play\s*area|play\s*space)\b/i },
  {
    tag: "food-markets",
    pattern: /\b(farmers'?\s*market|food\s*hall|public\s*market|market\s*hall|mercado|food\s*truck)\b/i,
  },
  {
    tag: "shopping",
    pattern:
      /\b(mall|outlets?|galleria|shopping\s*(center|centre|district|village)|westfield|mills|marketplace)\b/i,
  },
  {
    tag: "entertainment",
    pattern:
      /\b(theat(er|re)|cinema|imax|arcade|concert|circus|observatory|planetarium\s*show|escape\s*room)\b/i,
  },
  { tag: "spas", pattern: /\b(spa|hot\s*springs|thermal\s*baths?|onsen|bathhouse)\b/i },
  {
    tag: "sports",
    pattern:
      /\b(aquatic|swim(ming)?|pool|stadium|arena|ballpark|golf|bowling|skate|climbing|surf(ing)?|kayak|bike\s*park)\b/i,
  },
  {
    tag: "beaches",
    pattern: /\b(beach|cove|boardwalk|pier|shore(line)?|seawall|waterfront|harbor|harbour|bay)\b/i,
  },
  {
    tag: "nature",
    pattern:
      /\b(trail|canyon|lookout|overlook|scenic|falls|waterfall|lake|mountain|nature|reserve|preserve|wetlands|cliffs|springs)\b/i,
  },
  { tag: "parks", pattern: /\b(park|gardens?|botanic(al)?|arboretum|greenway|commons)\b/i },
];

/**
 * Best-effort category for a venue we only know by name. Used when a stop
 * reaches the itinerary without catalog tags (e.g. a Places result that lost
 * its search category), so it still competes under the day-uniqueness rule.
 */
export function inferInterestTagsFromName(name: string): LandmarkInterestTag[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  for (const rule of NAME_RULES) {
    if (rule.pattern.test(trimmed)) return [rule.tag];
  }
  return [];
}

function landmarkByName(city: CityConfig, name: string | undefined): Landmark | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return (
    city.landmarks.find((l) => l.name.trim().toLowerCase() === key) ??
    city.landmarks.find((l) => {
      const candidate = l.name.trim().toLowerCase();
      return candidate.includes(key) || key.includes(candidate);
    }) ??
    null
  );
}

/** True for stops that take part in category balancing (not strolls or breaks). */
export function isCategorizableActivity(activity: ItineraryActivity): boolean {
  return activity.type === "activity" && !isUnpaidTimelineActivity(activity);
}

/**
 * Normalized categories for one stop: catalog tags win, then the matching city
 * landmark, then the venue name. Returns [] only when nothing can be inferred,
 * which keeps the stop out of category-balanced selection entirely.
 */
export function classifyActivityInterestTags(
  activity: ItineraryActivity,
  city: CityConfig,
): LandmarkInterestTag[] {
  if (activity.interestTags?.length) return activity.interestTags;
  if (!isCategorizableActivity(activity)) return [];

  const venue = activity.location?.name ?? activity.title;
  const landmark = landmarkByName(city, activity.location?.name);
  if (landmark?.interestTags.length) return landmark.interestTags;
  return inferInterestTagsFromName(venue);
}

/**
 * Give every stop a normalized classification before the day-uniqueness rule
 * runs, so two untagged venues in the same category cannot slip past it.
 */
export function classifyActivities(
  activities: ItineraryActivity[],
  city: CityConfig,
): ItineraryActivity[] {
  return activities.map((activity) => {
    if (activity.interestTags?.length || !isCategorizableActivity(activity)) return activity;
    const tags = classifyActivityInterestTags(activity, city);
    return tags.length > 0 ? { ...activity, interestTags: tags } : activity;
  });
}
