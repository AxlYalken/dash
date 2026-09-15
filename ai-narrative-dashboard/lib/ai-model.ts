import { gateway } from "ai";

export function aiConfigurationError(): string | null {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    return "Генерация не настроена: добавьте AI_GATEWAY_API_KEY в переменные окружения проекта Netlify и запустите новый деплой. Локально добавьте ключ в .env.local и перезапустите сервер.";
  }
  if (!process.env.AI_MODEL?.trim() || !/^[^\s/]+\/[^\s]+$/.test(process.env.AI_MODEL.trim())) {
    return "Генерация не настроена: укажите AI_MODEL — полный идентификатор модели из каталога Vercel (провайдер/модель) — и запустите новый деплой.";
  }
  return null;
}

export function getAIModel() {
  return gateway(process.env.AI_MODEL!.trim());
}
