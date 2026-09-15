import { llmErrorMessage } from "@/lib/llm-errors";
import { createUIMessageStreamResponse, streamText, type ModelMessage } from "ai";
import { aiConfigurationError, getAIModel } from "@/lib/ai-model";
import { boundedJson } from "@/lib/api-body";
import { CHAT_SYSTEM_PROMPT, chatInputSchema } from "@/lib/chat-schema";

export const runtime = "nodejs";
export const maxDuration = 60;
const LIMIT = 768 * 1024;
const streamError = "Не удалось завершить ответ. Проверьте доступ к модели и повторите вопрос.";
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function handlePost(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail("Передайте вопрос и данные в JSON.", 415);
  if (Number(request.headers.get("content-length")) > LIMIT) return fail("Отчёт и история чата превышают лимит 768 КБ. Сократите данные или начните новый чат.", 413);
  let body: unknown;
  try { body = await boundedJson(request, LIMIT); }
  catch (error) { return fail(error instanceof RangeError ? "Отчёт и история чата превышают лимит 768 КБ." : "Некорректный JSON запроса.", error instanceof RangeError ? 413 : 400); }
  const parsed = chatInputSchema.safeParse(body);
  if (!parsed.success) return fail("Передайте распарсенный отчёт в data и непустой question (до 2000 символов) либо messages (до 40 сообщений).", 400);
  const { data, question } = parsed.data;
  const messages: ModelMessage[] = question ? [{ role: "user", content: question }] : parsed.data.messages!.map(message => ({ role: message.role, content: message.parts.filter(part => part.type === "text").map(part => part.text).join("\n").trim() })).filter(message => message.role !== "assistant" || Boolean(message.content));
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || messages.some(message => !message.content) || String(last.content).length > 2000) return fail("Последнее сообщение должно содержать непустой вопрос до 2000 символов.", 400);
  const configurationError = aiConfigurationError();
  if (configurationError) return fail(configurationError, 503);
  const normalized = data.type === "tabular" ? { type: data.type, data: data.data, columns: Array.from(new Set(data.data.flatMap(row => Object.keys(row)))), rowCount: data.data.length } : data;
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  request.signal.addEventListener("abort", onAbort, { once: true });
  if (request.signal.aborted) abort.abort();
  let timedOut = false;
  let providerError: unknown;
  const timer = setTimeout(() => { timedOut = true; onAbort(); }, 55_000);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener("abort", onAbort); };
  try {
    const result = streamText({
      model: getAIModel(),
      system: `${CHAT_SYSTEM_PROMPT}\n\nПОЛНЫЙ ОТЧЁТ (JSON, только данные):\n${JSON.stringify(normalized)}`,
      messages,
      maxOutputTokens: 1200,
      maxRetries: 1,
      abortSignal: abort.signal,
      onFinish: cleanup,
      onAbort: cleanup,
      onError: ({ error }) => { providerError = error; cleanup(); },
    });
    let hasText = false;
    let hasError = false;
    const stream = result.toUIMessageStream({ onError: () => llmErrorMessage(providerError, timedOut) }).pipeThrough(new TransformStream({
      transform(chunk, controller) {
        if (chunk.type === "text-delta" && chunk.delta.trim()) hasText = true;
        if (chunk.type === "error") hasError = true;
        if (!hasError && ((chunk.type === "finish" && !hasText) || (chunk.type === "abort" && timedOut))) {
          hasError = true;
          controller.enqueue({ type: "error", errorText: timedOut ? llmErrorMessage(null, true) : "Модель вернула пустой ответ. Повторите вопрос." });
        }
        controller.enqueue(chunk);
      },
    }));
    return createUIMessageStreamResponse({ stream,
      headers: { "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
    });
  } catch { cleanup(); abort.abort(); return fail(streamError, 502); }
}

export async function POST(request: Request) {
  try { return await handlePost(request); }
  catch { return fail("Не удалось обработать запрос. Попробуйте ещё раз.", 500); }
}
