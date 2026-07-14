import { BudgetStyle } from "@/types/trip-plan";

/**
 * Splits a list into cheap/mid/premium thirds by price, with no dollar
 * threshold involved — "affordable" is always relative to what a
 * destination actually offers, not a fixed cap.
 */
export function priceTiers<T>(
  items: T[],
  getPrice: (item: T) => number,
): { cheap: T[]; mid: T[]; premium: T[] } {
  const sorted = [...items].sort((a, b) => getPrice(a) - getPrice(b));
  const n = sorted.length;
  if (n === 0) return { cheap: [], mid: [], premium: [] };

  const cheapEnd = Math.max(1, Math.ceil(n / 3));
  const midEnd = Math.max(cheapEnd, Math.ceil((2 * n) / 3));

  return {
    cheap: sorted.slice(0, cheapEnd),
    mid: sorted.slice(cheapEnd, midEnd),
    premium: sorted.slice(midEnd),
  };
}

/**
 * Picks the pool of items appropriate for a Budget Style.
 *
 * - save: always the cheap tier (free/low-cost).
 * - splurge: always the premium tier — never rejected for being expensive.
 * - balanced: cheap tier by default, but the day's one "main" slot
 *   (opts.allowPremiumPick) may draw from mid/premium — this is what
 *   realizes "approximately one major paid attraction per day."
 */
export function landmarksForStyle<T>(
  items: T[],
  getPrice: (item: T) => number,
  style: BudgetStyle | "",
  opts?: { allowPremiumPick?: boolean },
): T[] {
  if (items.length === 0) return items;
  const { cheap, mid, premium } = priceTiers(items, getPrice);
  const effectiveStyle: BudgetStyle = style || "balanced";

  let pool: T[];
  if (effectiveStyle === "save") {
    pool = cheap;
  } else if (effectiveStyle === "splurge") {
    pool = premium.length > 0 ? premium : [...mid, ...cheap];
  } else {
    pool = opts?.allowPremiumPick ? [...mid, ...premium] : cheap;
  }

  return pool.length > 0 ? pool : items;
}

/** Short, informational note shown under the daily cost breakdown — no cap, no percentage. */
export function budgetStyleNote(style: BudgetStyle | ""): string {
  switch (style) {
    case "save":
      return "Kept things light and mostly free today — right in line with your Save Money style.";
    case "splurge":
      return "A few premium picks today, right in line with your Treat Ourselves style.";
    default:
      return "A mix of free and paid experiences today, balanced with your style.";
  }
}
