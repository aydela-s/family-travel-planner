/**
 * Shopping destination quality — prefer destination malls / outlets / notable retail,
 * not strip centers or nameless plazas. Missing website is a hard red flag.
 */

import { normalizePlaceTypes } from "@/lib/maps/family-friendly-places";

/** True when this Places text-search category is shopping-oriented. */
export function isShoppingSearchCategory(category: string): boolean {
  return /\b(shopping|mall|outlet|outlets|retail\s+destination)\b/i.test(category.trim());
}

/**
 * Destination-worthy shopping names: major malls, outlets, iconic retail destinations.
 * Generic "Shops at X" / strip centers are excluded unless they also look like a mall.
 */
export const DESTINATION_SHOPPING_NAME =
  /\b(mall|malls|outlet|outlets|premium\s+outlets|factory\s+outlets|outlet\s+center|galleria|westfield|simon|northpark|north\s*park|southdale|tanger|sawgrass|citadel\s+outlets|fashion\s+island|rodeo\s+drive|fifth\s+avenue|magnificent\s+mile|oxford\s+street|ginza|shopping\s+district|market\s+street|grapevine\s+mills|mills)\b/i;

/** Weak strip / plaza retail — not trip-worthy shopping stops. */
export const WEAK_SHOPPING_NAME =
  /\b(shops?\s+at|shopping\s+center|strip\s+(mall|center)|power\s+center|retail\s+center|plaza\s+(shopping|retail)|town\s+center\s+shops?)\b/i;

const DESTINATION_SHOPPING_TYPES = new Set([
  "shopping_mall",
  "department_store",
]);

export type ShoppingPlaceSignals = {
  name: string;
  types?: string[];
  primaryType?: string | null;
  /** Places websiteUri — missing website is a red flag for shopping. */
  websiteUri?: string | null;
};

export function hasShoppingWebsite(websiteUri?: string | null): boolean {
  const trimmed = websiteUri?.trim() ?? "";
  if (!trimmed) return false;
  // Reject placeholder / Maps-only style emptiness
  return /^https?:\/\//i.test(trimmed);
}

export function hasDestinationShoppingType(
  types?: string[],
  primaryType?: string | null,
): boolean {
  return normalizePlaceTypes(types, primaryType).some((t) =>
    DESTINATION_SHOPPING_TYPES.has(t),
  );
}

export function looksLikeDestinationShoppingName(name: string): boolean {
  return DESTINATION_SHOPPING_NAME.test(name);
}

export function looksLikeWeakShoppingName(name: string): boolean {
  if (looksLikeDestinationShoppingName(name)) return false;
  return WEAK_SHOPPING_NAME.test(name);
}

/**
 * Hard gate for shopping-category Places results.
 * Keep destination malls/outlets with a real website; drop strip centers and no-website POIs.
 */
export function isDestinationShoppingPlace(opts: ShoppingPlaceSignals): boolean {
  if (!hasShoppingWebsite(opts.websiteUri)) return false;
  if (looksLikeWeakShoppingName(opts.name)) return false;

  const mallType = hasDestinationShoppingType(opts.types, opts.primaryType);
  const strongName = looksLikeDestinationShoppingName(opts.name);
  return mallType || strongName;
}

/** Extra ranking boost for destination malls/outlets (on top of familyPlaceScore). */
export function shoppingPlaceScoreBoost(opts: ShoppingPlaceSignals): number {
  if (!isDestinationShoppingPlace(opts)) return 0;
  let boost = 1.5;
  if (hasDestinationShoppingType(opts.types, opts.primaryType)) boost += 2.0;
  if (/\boutlet/i.test(opts.name)) boost += 1.5;
  if (looksLikeDestinationShoppingName(opts.name)) boost += 1.0;
  return boost;
}
