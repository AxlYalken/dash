export function llmErrorMessage(error: unknown, timedOut = false): string {
  if (timedOut || (error instanceof Error && /timeout|abort/i.test(error.name))) return "Модель не успела ответить. Повторите попытку через несколько секунд.";
  const status = error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
  if (status === 401) return "Не удалось авторизоваться в Netlify AI Gateway. Проверьте доступность AI-функций Netlify и выполните новый деплой.";
  if (status === 402) return "Не удалось выполнить запрос: проверьте остаток кредитов Netlify AI Gateway и доступность модели на вашем тарифе.";
  if (status === 403 || status === 404) return "Не удалось получить доступ к модели. Проверьте AI_MODEL и доступность модели в вашем аккаунте Netlify AI Gateway.";
  if (status === 429) return "Лимит запросов к модели временно исчерпан. Подождите немного и повторите попытку.";
  return "Не удалось получить ответ модели. Проверьте доступ к модели и повторите попытку.";
}
