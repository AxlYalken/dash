import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_MODEL = "gpt-4.1-mini";

export function aiConfigurationError(): string | null {
  if (!process.env.OPENAI_API_KEY?.trim() || !process.env.OPENAI_BASE_URL?.trim()) {
    return "Генерация не настроена: Netlify AI Gateway ещё не выдал параметры подключения. Проверьте тариф с кредитами, разрешение AI-функций и выполните production-деплой. Вручную ключи добавлять не нужно.";
  }
  try {
    const url = new URL(process.env.OPENAI_BASE_URL);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("invalid URL");
  } catch {
    return "Генерация не настроена: некорректный адрес Netlify AI Gateway. Удалите вручную заданный OPENAI_BASE_URL и выполните новый деплой.";
  }
  if (process.env.AI_MODEL && !/^[^\s]+$/.test(process.env.AI_MODEL.trim())) {
    return "Генерация не настроена: проверьте AI_MODEL или удалите эту переменную для модели по умолчанию.";
  }
  return null;
}

export function getAIModel() {
  const error = aiConfigurationError();
  if (error) throw new Error(error);
  // Netlify supplies the provider URL without /v1; avoid duplicating it if present.
  const root = process.env.OPENAI_BASE_URL!.trim().replace(/\/+$/, "");
  const baseURL = root.endsWith("/v1") ? root : `${root}/v1`;
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim(), baseURL }).chat(process.env.AI_MODEL?.trim() || DEFAULT_MODEL);
}
