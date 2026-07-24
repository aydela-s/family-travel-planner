import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_AI_GATEWAY_MODEL,
  getAiGatewayModelId,
  isAiGatewayConfigured,
  shouldEnrichItineraryWithAi,
} from "@/lib/ai/config";

const ENV_KEYS = [
  "AI_GATEWAY_API_KEY",
  "AI_GATEWAY_MODEL",
  "OPENAI_API_KEY",
  "VERCEL",
  "VERCEL_ENV",
  "AI_ENRICH_TIPS",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("AI Gateway config — FAM-47", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("defaults the gateway model id", () => {
    stashEnv();
    expect(getAiGatewayModelId()).toBe(DEFAULT_AI_GATEWAY_MODEL);
  });

  it("allows overriding the model via AI_GATEWAY_MODEL", () => {
    stashEnv();
    process.env.AI_GATEWAY_MODEL = "anthropic/claude-sonnet-4.6";
    expect(getAiGatewayModelId()).toBe("anthropic/claude-sonnet-4.6");
  });

  it("detects configuration from AI_GATEWAY_API_KEY", () => {
    stashEnv();
    expect(isAiGatewayConfigured()).toBe(false);
    process.env.AI_GATEWAY_API_KEY = "test-key";
    expect(isAiGatewayConfigured()).toBe(true);
  });

  it("skips tip enrichment in demo mode", () => {
    stashEnv();
    process.env.AI_GATEWAY_API_KEY = "test-key";
    expect(shouldEnrichItineraryWithAi(true)).toBe(false);
    expect(shouldEnrichItineraryWithAi(false)).toBe(true);
  });

  it("can disable tip enrichment explicitly", () => {
    stashEnv();
    process.env.AI_GATEWAY_API_KEY = "test-key";
    process.env.AI_ENRICH_TIPS = "false";
    expect(shouldEnrichItineraryWithAi(false)).toBe(false);
  });
});
