import { expect, it } from "vitest";
import { llmErrorMessage } from "./llm-errors";
it("distinguishes rate limits and timeouts without exposing raw messages", () => {
  expect(llmErrorMessage({ statusCode: 429, message: "secret" })).toContain("Лимит запросов");
  expect(llmErrorMessage(null, true)).toContain("не успела");
  expect(llmErrorMessage(new Error("secret"))).not.toContain("secret");
});

it.each([401, 402, 403, 404])("explains Gateway status %s without leaking provider details", statusCode => {
  const message = llmErrorMessage({ statusCode, message: "secret-key" });
  expect(message).toContain("Netlify");
  expect(message).not.toContain("secret-key");
});
