import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { aiConfigurationError, getAIModel } from "./ai-model";
import { generateText } from "ai";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "netlify-test-key");
  vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/openai");
  vi.stubEnv("AI_MODEL", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("uses Netlify-injected settings and the default model", () => {
  expect(aiConfigurationError()).toBeNull();
  expect(getAIModel().modelId).toBe("gpt-4.1-mini");
});
it("does not fall back to a direct provider endpoint", () => {
  vi.stubEnv("OPENAI_BASE_URL", "");
  expect(aiConfigurationError()).toContain("Netlify AI Gateway");
  expect(() => getAIModel()).toThrow();
});
it("rejects a missing key and invalid URLs", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(aiConfigurationError()).not.toBeNull();
  vi.stubEnv("OPENAI_API_KEY", "test"); vi.stubEnv("OPENAI_BASE_URL", "file:///tmp/key");
  expect(aiConfigurationError()).not.toBeNull();
});
it.each(["https://gateway.example/openai", "https://gateway.example/openai/v1/"])("sends requests to the injected endpoint: %s", async base => {
  vi.stubEnv("OPENAI_BASE_URL", base);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "test", created: 1, model: "gpt-4.1-mini", choices: [{ index: 0, message: { role: "assistant", content: "Ответ" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  vi.stubGlobal("fetch", fetcher);
  const result = await generateText({ model: getAIModel(), prompt: "Вопрос" });
  expect(result.text).toBe("Ответ");
  expect(String(fetcher.mock.calls[0][0])).toBe("https://gateway.example/openai/v1/chat/completions");
  expect(new Headers(fetcher.mock.calls[0][1].headers).get("authorization")).toBe("Bearer netlify-test-key");
});
