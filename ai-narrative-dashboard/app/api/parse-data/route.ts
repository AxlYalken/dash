import { NextResponse } from "next/server";
import { MAX_BYTES, ParseDataError, parseFile, parseText } from "@/lib/parse-data";
import type { HeaderMode, ParseDataResponse } from "@/lib/parse-data-types";

export const runtime = "nodejs";

function headerMode(value: unknown): HeaderMode {
  if (value == null || value === "auto") return "auto";
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new ParseDataError("hasHeaders должен быть true, false или auto.", 400);
}

// Bound actual bytes as well as Content-Length, including chunked requests.
async function readBody(request: Request): Promise<Uint8Array> {
  const limit = MAX_BYTES + 64 * 1024; // multipart envelope allowance
  if (Number(request.headers.get("content-length")) > limit) throw new ParseDataError("Запрос слишком большой. Максимум — 10 МБ данных.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ParseDataError("Передайте файл или текст.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new ParseDataError("Запрос слишком большой. Максимум — 10 МБ данных.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}

export async function POST(request: Request) {
  let type: "tabular" | "text" = "text";
  try {
    const contentType = request.headers.get("content-type") || "";
    const mime = contentType.split(";")[0].trim().toLowerCase();
    if (!["multipart/form-data", "application/json", "text/plain"].includes(mime)) throw new ParseDataError("Используйте multipart/form-data с полем file или text, JSON { text } либо text/plain.", 415);
    const bytes = await readBody(request);
    let text: unknown;
    if (mime === "multipart/form-data") {
      let form: FormData;
      try { form = await new Response(bytes as BodyInit, { headers: { "content-type": contentType } }).formData(); }
      catch { throw new ParseDataError("Не удалось прочитать форму загрузки. Отправьте файл повторно.", 400); }
      const files = form.getAll("file");
      const texts = form.getAll("text");
      if (files.length > 1 || texts.length > 1 || (files.length && texts.length)) throw new ParseDataError("Передайте один файл или один текст, не оба сразу.", 400);
      if (files.length) {
        type = "tabular";
        const file = files[0];
        if (typeof file === "string") throw new ParseDataError("Поле file должно содержать файл.", 400);
        return NextResponse.json<ParseDataResponse>(parseFile(new Uint8Array(await file.arrayBuffer()), file.name, headerMode(form.get("hasHeaders"))));
      }
      text = texts[0];
    } else if (mime === "application/json") {
      let body: unknown;
      try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { throw new ParseDataError("Некорректный JSON. Ожидается объект с полем text.", 400); }
      if (!body || typeof body !== "object" || Array.isArray(body) || "file" in body) throw new ParseDataError("Для текста используйте JSON { text: строка }, для файла — multipart/form-data.", 400);
      text = (body as { text?: unknown }).text;
    } else {
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new ParseDataError("Не удалось прочитать текст. Используйте UTF-8.", 400); }
    }
    if (typeof text !== "string") throw new ParseDataError("Передайте непустую строку в поле text.", 400);
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new ParseDataError("Текст слишком большой. Максимум — 10 МБ.", 413);
    return NextResponse.json<ParseDataResponse>(parseText(text));
  } catch (error) {
    const known = error instanceof ParseDataError;
    const message = known ? error.message : "Не удалось обработать данные. Проверьте файл или текст и повторите попытку.";
    const code = known ? error.code : "INTERNAL_ERROR";
    const body: ParseDataResponse = type === "tabular" ? { type, data: [], error: message, code } : { type, data: "", error: message, code };
    return NextResponse.json<ParseDataResponse>(body, { status: known ? error.status : 500 });
  }
}
