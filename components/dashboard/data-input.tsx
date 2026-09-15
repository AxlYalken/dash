"use client";

import { useEffect, useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { InputZone, type InputData } from "@/components/dashboard/input-zone";
import { HeroInsightWidget } from "@/components/dashboard/hero-insight-widget";
import { insightInputSchema, insightSchema, validInsight, type InsightInput } from "@/lib/insight-schema";

import { ClientRequestError, readApiJson, requestMessage } from "@/lib/client-errors";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeedbackState } from "./feedback-state";
import { ChartsGrid } from "./charts-grid";
import { Reveal } from "./reveal";
import { ChatWithData } from "./chat-with-data";

async function insightFetch(input: RequestInfo | URL, init?: RequestInit) {
  let response: Response;
  try { response = await fetch(input, init); } catch (error) { if (init?.signal?.aborted) throw error; throw new Error("Не удалось связаться с моделью. Проверьте соединение и повторите попытку."); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((typeof body?.error === "string" ? body.error : undefined) || "Не удалось начать генерацию. Попробуйте ещё раз.");
  }
  return response;
}

export function DataInput() {
  const [dataset, setDataset] = useState<{ id: number; data: InsightInput } | null>(null);
  const generation = useRef(0);
  const [inputKey, setInputKey] = useState(0);
  const [inputIssue, setInputIssue] = useState<{ kind: "error" | "empty"; message: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raw = useRef<InputData | null>(null);
  const parseController = useRef<AbortController | null>(null);
  const { object, submit, isLoading, stop, clear } = useObject({
    api: "/api/generate-insight",
    schema: insightSchema,
    fetch: insightFetch,
    onError: error => setError(/^(Генерация не настроена|Не удалось|Лимит|Модель)/.test(error.message) || error.message.includes("512 КБ") ? error.message : "Поток ответа прервался. Повторите генерацию."),
    onFinish: ({ object, error }) => {
      if (error || !object || !validInsight(object)) setError("Модель вернула неполный или некорректный инсайт. Попробуйте ещё раз.");
    },
  });
  useEffect(() => () => { parseController.current?.abort(); parseController.current = null; stop(); }, [stop]);

  async function handleData(data: InputData) {
    if (parseController.current || isLoading) return;
    raw.current = data;
    clear(); setError(null); setInputIssue(null); setDataset(null); setParsing(true);
    const controller = new AbortController();
    parseController.current = controller;
    const parseTimeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const form = new FormData();
      if (data.source === "file") form.append("file", data.file);
      else form.append("text", data.text);
      const response = await fetch("/api/parse-data", { method: "POST", body: form, signal: controller.signal });
      const body = await readApiJson(response);
      if (controller.signal.aborted) return;
      if (!response.ok || body.error) throw new ClientRequestError(typeof body.error === "string" ? body.error : "Не удалось разобрать данные.", typeof body.code === "string" ? body.code : undefined);
      const parsed = insightInputSchema.safeParse(body);
      if (!parsed.success) throw new ClientRequestError("Не удалось проверить распарсенные данные. Попробуйте меньший набор.");
      setDataset({ id: ++generation.current, data: parsed.data });
      submit(parsed.data);
    } catch (error) {
      if (parseController.current === controller) setInputIssue({ kind: error instanceof ClientRequestError && error.code === "EMPTY_DATA" ? "empty" : "error", message: controller.signal.aborted ? "Сервер не успел обработать данные. Попробуйте файл меньшего размера." : requestMessage(error) });
    } finally {
      clearTimeout(parseTimeout);
      if (parseController.current === controller) parseController.current = null;
      setParsing(false);
    }
  }

  function resetInput() {
    setInputIssue(null); setError(null); setDataset(null); raw.current = null; clear(); setInputKey(value => value + 1);
  }
  function retryInsight() {
    if (parsing || isLoading) return;
    setError(null);
    if (dataset) submit(dataset.data);
    else if (raw.current) void handleData(raw.current);
  }
  return (
    <div className="section-stack">
      <ErrorBoundary name="загрузку данных" resetKey={inputKey}><Reveal>
        {inputIssue ? <FeedbackState kind={inputIssue.kind} title={inputIssue.kind === "empty" ? "В файле нет данных" : "Не удалось прочитать файл"} message={inputIssue.kind === "empty" ? "Загрузите CSV или Excel с непустыми строками либо вставьте текст отчёта." : `Не удалось прочитать файл, попробуй другой формат. ${inputIssue.message}`} action="Попробовать снова" onRetry={resetInput} /> : <InputZone key={inputKey} onProcessingStart={() => { setDataset(null); clear(); setError(null); }} onDataReady={handleData} disabled={parsing || isLoading} />}
      </Reveal></ErrorBoundary>
      <ErrorBoundary name="главный вывод" resetKey={dataset?.id}><Reveal delay={0.05}><HeroInsightWidget insight={object} isLoading={isLoading} isParsing={parsing} error={error} onRetry={raw.current ? retryInsight : undefined} /></Reveal></ErrorBoundary>
      <ErrorBoundary name="графики" resetKey={dataset?.id}><Reveal delay={0.1}><ChartsGrid data={dataset?.data ?? null} /></Reveal></ErrorBoundary>
      <ErrorBoundary name="чат" resetKey={dataset?.id}><ChatWithData key={dataset?.id ?? "empty"} data={dataset?.data ?? null} suggestedQuestions={!isLoading && !error ? object?.suggestedQuestions?.filter((q): q is string => typeof q === "string") : []} /></ErrorBoundary>
    </div>
  );
}
