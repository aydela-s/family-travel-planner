import type { RestaurantDietary } from "@/config/city-restaurants";

const DIETARY_ALIASES: { tag: RestaurantDietary; patterns: RegExp[] }[] = [
  { tag: "vegan", patterns: [/\bvegan\b/i] },
  { tag: "vegetarian", patterns: [/\bvegetarian\b/i, /\bveggie\b/i] },
  { tag: "gluten-free", patterns: [/\bgluten[-\s]?free\b/i, /\bceliac\b/i] },
  { tag: "dairy-free", patterns: [/\bdairy[-\s]?free\b/i, /\blactose\b/i] },
];

export function parseDietaryTags(dietaryRestrictions: string): RestaurantDietary[] {
  if (!dietaryRestrictions.trim()) return [];
  const found: RestaurantDietary[] = [];
  for (const { tag, patterns } of DIETARY_ALIASES) {
    if (patterns.some((p) => p.test(dietaryRestrictions))) found.push(tag);
  }
  return found;
}

/**
 * Wording that credibly states a venue serves a diet, e.g. a name like
 * "Loving Hut Vegan" or a review line "great vegan options for the kids".
 * Deliberately narrow: a diet word alone ("vegan sausage roll was sold out")
 * is not treated as proof, and anything hedged or negated is ignored.
 */
const DIETARY_EVIDENCE_PATTERNS: Array<{ tag: RestaurantDietary; pattern: RegExp }> = [
  { tag: "vegan", pattern: /\bvegan\s+(options?|menu|dishes|choices|selection|friendly)\b/i },
  { tag: "vegan", pattern: /\b(plenty|lots|several|many|great|good)\s+(of\s+)?vegan\b/i },
  { tag: "vegan", pattern: /\bvegan\b(?=[^.!?]*\b(available|served|offered)\b)/i },
  {
    tag: "gluten-free",
    pattern: /\bgluten[-\s]?free\s+(options?|menu|dishes|choices|selection|friendly|bread|pasta)\b/i,
  },
  {
    tag: "gluten-free",
    pattern: /\b(plenty|lots|several|many|great|good)\s+(of\s+)?gluten[-\s]?free\b/i,
  },
  { tag: "vegetarian", pattern: /\bvegetarian\s+(options?|menu|dishes|choices|selection|friendly)\b/i },
  { tag: "dairy-free", pattern: /\bdairy[-\s]?free\s+(options?|menu|dishes|choices|milk|alternatives)\b/i },
];

/** Hedged or negated claims never count as evidence. */
const WEAK_EVIDENCE = /\b(no|not|none|without|lack|lacked|limited|barely|hardly|unclear|maybe|might|used to)\b/i;

/**
 * Conservative dietary evidence from free text (venue name, editorial summary,
 * review snippets). Only explicit "X options / menu / available" style claims in
 * a sentence with no hedging or negation produce a tag.
 */
export function dietaryEvidenceFromText(texts: Array<string | null | undefined>): RestaurantDietary[] {
  const found = new Set<RestaurantDietary>();
  for (const raw of texts) {
    const text = (raw ?? "").trim();
    if (!text) continue;
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
      if (WEAK_EVIDENCE.test(sentence)) continue;
      for (const { tag, pattern } of DIETARY_EVIDENCE_PATTERNS) {
        if (pattern.test(sentence)) found.add(tag);
      }
      // A venue whose own name states the diet is dedicated enough to count.
      for (const tag of parseDietaryTags(sentence)) {
        if (/\b(vegan|vegetarian|gluten[-\s]?free|dairy[-\s]?free)\s*(kitchen|cafe|café|restaurant|bakery|eatery|grill|bar|house|deli|bistro)\b/i.test(sentence)) {
          found.add(tag);
        }
      }
    }
  }
  return [...found];
}
