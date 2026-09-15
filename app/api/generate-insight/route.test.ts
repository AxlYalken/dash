// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { POST } from "./route";

let model: MockLanguageModelV3;
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => ({ chat: () => model }) }));
const request = (data: unknown) => new Request("http://localhost/api/generate-insight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
const input = { type: "text", data: "Выручка выросла с 100 до 120." };
const questions = ["Как изменилась выручка?", "Какие значения сравниваются?", "Есть ли данные о причинах роста?"];
const insight = { headline: "Выручка выросла на 20%", subtext: "Выручка выросла со 100 до 120, то есть на 20%. Причину роста данные не объясняют.", suggestedQuestions: questions };
const finish: LanguageModelV3StreamPart = { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 20, reasoning: 0 } } };
function mockOutput(value: unknown) {
  model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({ start(c) {
    c.enqueue({ type: "text-start", id: "1" });
    c.enqueue({ type: "text-delta", id: "1", delta: JSON.stringify(value) });
    c.enqueue({ type: "text-end", id: "1" }); c.enqueue(finish); c.close();
  } }) }) });
}
beforeEach(() => { vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/openai"); vi.stubEnv("AI_MODEL", "test/model"); vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_OIDC_TOKEN", ""); vi.stubEnv("OPENAI_API_KEY", "test-key-not-real"); mockOutput(insight); });
afterEach(() => vi.unstubAllEnvs());

describe("generate-insight", () => {
  it("streams the first partial JSON before the model completes", async () => {
    let source!: ReadableStreamDefaultController<LanguageModelV3StreamPart>;
    model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({ start(c) {
      source = c; c.enqueue({ type: "text-start", id: "1" }); c.enqueue({ type: "text-delta", id: "1", delta: '{"headline":"Выручка' });
    } }) }) });
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const first = await reader.read();
    const decoder = new TextDecoder();
    let text = decoder.decode(first.value);
    expect(text).toContain("Выручка");
    expect(text).not.toContain("subtext");
    source.enqueue({ type: "text-delta", id: "1", delta: JSON.stringify(insight).slice('{"headline":"Выручка'.length) });
    source.enqueue({ type: "text-end", id: "1" }); source.enqueue(finish); source.close();
    while (true) { const chunk = await reader.read(); if (chunk.done) break; text += decoder.decode(chunk.value); }
    expect(JSON.parse(text)).toEqual(insight);
    expect(model.doStreamCalls[0].prompt[0].content).toContain("максимум 8 слов");
  });
  it("returns a helpful configuration error without calling the model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request(input));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Netlify AI Gateway");
    expect(model.doStreamCalls).toHaveLength(0);
  });
  it("validates the payload and request size before model calls", async () => {
    for (const data of [{ type: "text", data: 123 }, { type: "tabular", data: ["bad"] }, { ...input, error: "failed" }]) expect((await POST(request(data))).status).toBe(400);
    const oversized = request({ type: "text", data: "a".repeat(600_000) });
    expect((await POST(oversized)).status).toBe(413);
    expect(model.doStreamCalls).toHaveLength(0);
  });
  it("lets the model explain insufficient data without inventing local fallback insights", async () => {
    const empty = { suggestedQuestions: questions, headline: "Данных недостаточно для вывода", subtext: "В таблице нет строк с данными. Добавьте показатели хотя бы за один период." };
    mockOutput(empty);
    expect(await (await POST(request({ type: "tabular", data: [] }))).json()).toEqual(empty);
  });
  it("recomputes table metadata from the actual rows", async () => {
    await (await POST(request({ type: "tabular", data: [{ value: 12 }], rowCount: 999, columns: ["fake"] }))).text();
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain('rowCount');
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("999");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("fake");
  });
  it("returns a sanitized provider failure", async () => {
    model = new MockLanguageModelV3({ doStream: async () => { throw new Error("secret-provider-error"); } });
    const response = await POST(request(input));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret-provider-error");
  });
  it("rejects malformed final output instead of reporting a completed insight", async () => {
    mockOutput({ headline: "Недостаточно", subtext: "Только одно предложение." });
    const response = await POST(request(input));
    await expect(response.text()).rejects.toThrow();
  });
});
