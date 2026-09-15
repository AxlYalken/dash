// @vitest-environment node
// Regression coverage for audit findings and the intentional personal-use API.
import { afterEach, expect, it, vi } from "vitest";
import { parseFile, parseText } from "./parse-data";
import { insightInputSchema } from "./insight-schema";
import { chatInputSchema } from "./chat-schema";
import { POST as chat } from "../app/api/chat/route";
import { streamText } from "ai";
vi.mock("ai", async original => ({ ...await original<typeof import("ai")>(), streamText: vi.fn(() => { throw new Error("audit-model-invoked"); }) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("audit: unauthenticated requests reach the paid model call", async () => {
 vi.stubEnv("OPENAI_API_KEY", "audit-fake-key"); vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/openai"); vi.stubEnv("AI_MODEL", "test/model");
 const response = await chat(new Request("http://localhost/api/chat", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({data:{type:"text",data:"Доход 100"},question:"Сколько?"})}));
 expect(streamText).toHaveBeenCalledOnce(); expect(response.status).toBe(502);
});
it("rejects text exceeding the dashboard limit", () => {
 expect(() => parseText("а".repeat(100001))).toThrow(/100 000/);
});
it("rejects amplification through huge CSV headers", () => {
 const csv = "a".repeat(1000) + ",n\n" + Array.from({length:600},(_,i)=>`x,${i}`).join("\n");
 const bytes = new TextEncoder().encode(csv);
 expect(() => parseFile(bytes,"report.csv",true)).toThrow(/колонки/);
 expect(bytes.length).toBeLessThan(5000);

});
it("audit: the 21st chat question exceeds the server history cap", () => {
 const messages=Array.from({length:41},(_,i)=>({role:i%2===0?"user":"assistant",parts:[{type:"text",text:"Вопрос или ответ"}]}));
 expect(chatInputSchema.safeParse({data:{type:"text",data:"Отчёт"},messages:messages.slice(0,39)}).success).toBe(true);
 expect(chatInputSchema.safeParse({data:{type:"text",data:"Отчёт"},messages}).success).toBe(false);
});
it("ignores empty assistant responses left by a stopped stream", async () => {
 vi.stubEnv("OPENAI_API_KEY", "audit-fake-key"); vi.stubEnv("OPENAI_BASE_URL", "https://gateway.example/openai");vi.stubEnv("AI_MODEL", "test/model");
 const messages=[{role:"user",parts:[{type:"text",text:"Первый вопрос"}]},{role:"assistant",parts:[{type:"step-start"}]},{role:"user",parts:[{type:"text",text:"Следующий вопрос"}]}];
 const response=await chat(new Request("http://localhost/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({data:{type:"text",data:"Отчёт"},messages})}));
 expect(response.status).toBe(502);expect(streamText).toHaveBeenCalledOnce();
});
it("validates column limits on direct API payloads", () => {
 const data=[Object.fromEntries(Array.from({length:501},(_,i)=>[`c${i}`,1]))];
 expect(insightInputSchema.safeParse({type:"tabular",data}).success).toBe(false);
});
