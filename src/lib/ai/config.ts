/** Vercel AI Gateway configuration (FAM-47). */

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

/** Default chat model via AI Gateway provider/model ids. */
export const DEFAULT_AI_GATEWAY_MODEL = "openai/gpt-4o-mini";

export function getAiGatewayModelId(): string {
  return process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_AI_GATEWAY_MODEL;
}

/**
 * True when local/dev has an AI Gateway key, or when running on Vercel
 * (OIDC can authenticate without a long-lived key).
 */
export function isAiGatewayConfigured(): boolean {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true;
  // Deployed on Vercel — AI SDK gateway provider can use OIDC.
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) return true;
  // Back-compat: treat legacy OpenAI key as enough to attempt gateway (BYOK-style).
  if (process.env.OPENAI_API_KEY?.trim()) return true;
  return false;
}

export function shouldEnrichItineraryWithAi(demo: boolean): boolean {
  if (demo) return false;
  if (process.env.AI_ENRICH_TIPS === "false") return false;
  return isAiGatewayConfigured();
}
