/** Schema + sanitizers for AI polish. Invalid payloads are discarded. */

export type PolishDayPayload = {
  day: number;
  displayTitle?: string;
  /** Map of `${day}|${time}|${title}` → tip, matching enrich-tips keys. */
  tips?: Record<string, string>;
};

export type PolishPayload = {
  days: PolishDayPayload[];
};

const MAX_TITLE_CHARS = 42;
const MIN_TITLE_CHARS = 8;
const MAX_TITLE_WORDS = 6;
const MIN_TITLE_WORDS = 2;
const MAX_TIP_WORDS = 18;

function stripMarkdownFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Accept a family-friendly day title. Rejects markdown, URLs, schedule verbs,
 * and titles that look like activity/restaurant copy.
 */
export function sanitizeDisplayTitle(raw: string | undefined): string | null {
  if (!raw) return null;
  const title = raw.replace(/\s+/g, " ").trim().replace(/^["'`]+|["'`]+$/g, "");
  if (title.length < MIN_TITLE_CHARS || title.length > MAX_TITLE_CHARS) return null;
  const words = wordCount(title);
  if (words < MIN_TITLE_WORDS || words > MAX_TITLE_WORDS) return null;
  if (/https?:\/\//i.test(title) || /[`*_#<>]/.test(title)) return null;
  if (/explore |visit |lunch at |dinner at |breakfast at /i.test(title)) return null;
  if (!/[a-zA-Z]/.test(title)) return null;
  return title;
}

export function sanitizeTip(raw: string | undefined): string | null {
  if (!raw) return null;
  const tip = raw.replace(/\s+/g, " ").trim();
  if (!tip || wordCount(tip) > MAX_TIP_WORDS) return null;
  if (/https?:\/\//i.test(tip) || /\$\d/.test(tip) || /[`*_#<>]/.test(tip)) return null;
  return tip;
}

export function parsePolishPayload(raw: string): PolishPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(raw));
  } catch {
    return null;
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.days)) return null;

  const days: PolishDayPayload[] = [];
  for (const item of parsed.days) {
    if (!isPlainObject(item)) continue;
    const day = typeof item.day === "number" && Number.isInteger(item.day) ? item.day : null;
    if (day == null || day < 1) continue;

    const displayTitle =
      typeof item.displayTitle === "string" ? sanitizeDisplayTitle(item.displayTitle) : null;

    const tips: Record<string, string> = {};
    if (isPlainObject(item.tips)) {
      for (const [key, value] of Object.entries(item.tips)) {
        if (typeof key !== "string" || typeof value !== "string") continue;
        const tip = sanitizeTip(value);
        if (tip) tips[key] = tip;
      }
    }

    days.push({
      day,
      ...(displayTitle ? { displayTitle } : {}),
      ...(Object.keys(tips).length > 0 ? { tips } : {}),
    });
  }

  if (days.length === 0) return null;
  return { days };
}
