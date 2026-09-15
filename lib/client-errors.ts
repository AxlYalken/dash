export class ClientRequestError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}
export async function readApiJson(response: Response): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new ClientRequestError("Сервер вернул нечитаемый ответ. Попробуйте ещё раз."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClientRequestError("Сервер вернул некорректный ответ. Попробуйте ещё раз.");
  return body as Record<string, unknown>;
}
export function requestMessage(error: unknown): string {
  return error instanceof ClientRequestError ? error.message : "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.";
}
