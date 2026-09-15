import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { aiConfigurationError } from "./ai-model";

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("AI_MODEL", "test/model");
});
afterEach(() => vi.unstubAllEnvs());
it("accepts a Gateway key without an OpenAI key", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  expect(aiConfigurationError()).toBeNull();
});
it("requires a Gateway API key even when Vercel OIDC variables are present", () => {
  vi.stubEnv("VERCEL_OIDC_TOKEN", "test-token");
  vi.stubEnv("VERCEL", "1");
  expect(aiConfigurationError()).toContain("AI_GATEWAY_API_KEY");
});
it("does not accept an OpenAI key as Gateway credentials", () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  expect(aiConfigurationError()).toContain("AI_GATEWAY_API_KEY");
});
it.each(["", "model-without-provider"])("requires a full model identifier: %s", value => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  vi.stubEnv("AI_MODEL", value);
  expect(aiConfigurationError()).toContain("AI_MODEL");
});
