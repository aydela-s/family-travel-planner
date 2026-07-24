import OpenAI from "openai";
import { generateText, gateway } from "ai";
import {
  AI_GATEWAY_BASE_URL,
  getAiGatewayModelId,
  isAiGatewayConfigured,
} from "@/lib/ai/config";

/**
 * OpenAI SDK client pointed at Vercel AI Gateway.
 * Prefer AI_GATEWAY_API_KEY; fall back to OPENAI_API_KEY for local BYOK-style setups.
 */
export function createGatewayOpenAI(): OpenAI {
  const apiKey =
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    // OpenAI SDK requires a string; on Vercel OIDC is handled by the AI SDK `gateway` provider.
    "unused";

  return new OpenAI({
    apiKey,
    baseURL: AI_GATEWAY_BASE_URL,
  });
}

/** Generate plain text through Vercel AI Gateway (AI SDK). */
export async function generateGatewayText(prompt: string): Promise<string> {
  if (!isAiGatewayConfigured()) {
    throw new Error("AI Gateway is not configured.");
  }

  const { text } = await generateText({
    model: gateway(getAiGatewayModelId()),
    prompt,
  });

  return text.trim();
}
