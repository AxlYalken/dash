import { generateObject } from "ai";
import { aiConfigurationError, getAIModel } from "@/lib/ai-model";
import { boundedJson } from "@/lib/api-body";
import { insightInputSchema } from "@/lib/insight-schema";
import { chartPlanSchema, CHART_PROMPT, resolveCharts } from "@/lib/chart-schema";
import { llmErrorMessage } from "@/lib/llm-errors";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail("Передайте данные отчёта в JSON.", 415);
    let body: unknown;
    try { body = await boundedJson(request, 512 * 1024); }
    catch (error) { return fail(error instanceof RangeError ? "Для графиков передайте не более 512 КБ данных." : "Не удалось прочитать данные отчёта.", error instanceof RangeError ? 413 : 400); }
    const parsed = insightInputSchema.safeParse(body);
    if (!parsed.success) return fail("Неверный формат данных для графиков.", 400);
    const input = parsed.data.type === "tabular" ? { type: "tabular" as const, data: parsed.data.data, columns: Array.from(new Set(parsed.data.data.flatMap(row => Object.keys(row)))), rowCount: parsed.data.data.length } : parsed.data;
    const config = aiConfigurationError();
    if (config) return fail(config, 503);
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    timeout = setTimeout(() => { timedOut = true; abort(); }, 50_000);
    const { object } = await generateObject({ model: getAIModel(), schema: chartPlanSchema, system: CHART_PROMPT, prompt: JSON.stringify(input), maxOutputTokens: 5000, maxRetries: 1, abortSignal: controller.signal });
    return Response.json(resolveCharts(object, parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(llmErrorMessage(error, timedOut), timedOut ? 504 : 502);
  } finally { clearTimeout(timeout); request.signal.removeEventListener("abort", abort); }
}
