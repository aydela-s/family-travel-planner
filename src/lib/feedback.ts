/** Shared validation for trip feedback (FAM-49). */

export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 4000;

export type FeedbackPayload = {
  message: string;
  email?: string;
  pageUrl?: string;
};

export type FeedbackValidation =
  | { ok: true; message: string; email?: string; pageUrl?: string }
  | { ok: false; error: string };

function normalizeEmail(raw: string | undefined): string | undefined {
  const email = raw?.trim();
  if (!email) return undefined;
  return email;
}

export function validateFeedbackPayload(input: unknown): FeedbackValidation {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid feedback payload." };
  }

  const body = input as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < FEEDBACK_MESSAGE_MIN) {
    return {
      ok: false,
      error: `Please write at least ${FEEDBACK_MESSAGE_MIN} characters so we can understand the issue.`,
    };
  }
  if (message.length > FEEDBACK_MESSAGE_MAX) {
    return {
      ok: false,
      error: `Feedback is too long (max ${FEEDBACK_MESSAGE_MAX} characters).`,
    };
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : undefined);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email doesn’t look valid." };
  }

  const pageUrl =
    typeof body.pageUrl === "string" && body.pageUrl.trim()
      ? body.pageUrl.trim().slice(0, 500)
      : undefined;

  return { ok: true, message, email, pageUrl };
}

export function buildFeedbackEmail(params: {
  message: string;
  email?: string;
  pageUrl?: string;
  brandName: string;
}): { subject: string; text: string; html: string } {
  const subject = `[${params.brandName} feedback]`;
  const lines = [
    params.message,
    "",
    "—",
    params.email ? `Reply-to: ${params.email}` : "Reply-to: (not provided)",
    params.pageUrl ? `Page: ${params.pageUrl}` : null,
  ].filter((line): line is string => line != null);

  const text = lines.join("\n");
  const html = lines
    .map((line) => (line === "" ? "<br/>" : escapeHtml(line)))
    .join("<br/>\n");

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
