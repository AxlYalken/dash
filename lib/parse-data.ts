import { MAX_REPORT_BYTES } from "./data-limits";
import { checkExcelContainer } from "./excel-container";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { CellValue, HeaderMode, ParseDataResponse } from "./parse-data-types";

export const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50_000;
const MAX_COLUMNS = 500;
const MAX_CELLS = 1_000_000;

export class ParseDataError extends Error {
  constructor(message: string, public status = 422, public code = "INVALID_DATA") { super(message); }
}

export function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\uFEFF]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .split("\n").map(line => line.trim()).filter(Boolean).join("\n").trim();
}

function cell(value: unknown): CellValue {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  const text = cleanText(String(value));
  if (!text) return null;
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  // Preserve leading zeros, large integers and decimal identifiers without guessing locales.
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) {
    const number = Number(text);
    if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER && text.replace(/\D/g, "").length <= 15) return number;
  }
  return text;
}

function normalizeTable(input: unknown[][], headers: HeaderMode): ParseDataResponse {
  if (input.length > MAX_ROWS + 1 || input.some(row => row.length > MAX_COLUMNS) || input.reduce((sum, row) => sum + row.length, 0) > MAX_CELLS) throw new ParseDataError("Таблица превышает лимит строк или ячеек.", 413);
  const rows = input.map(row => Array.from(row, cell)).filter(row => row.some(value => value !== null));
  if (!rows.length) throw new ParseDataError("Файл пуст: в нём нет данных.", 422, "EMPTY_DATA");
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (rows.length > MAX_ROWS + 1 || width > MAX_COLUMNS || rows.length * width > MAX_CELLS) throw new ParseDataError("Таблица слишком большая: максимум 50 000 строк, 500 колонок и 1 000 000 ячеек.", 413);
  const first = rows[0];
  // Auto is deliberately conservative: an all-text table is ambiguous. Use hasHeaders explicitly.
  const inferred = first.every(v => typeof v === "string" || v === null) && first.some(v => typeof v === "string") &&
    rows.slice(1, 21).some(row => first.some((v, i) => typeof v === "string" && row[i] != null && typeof row[i] !== "string"));
  const hasHeaders = headers === "auto" ? inferred : headers;
  const used = new Set<string>();
  const columns = Array.from({ length: width }, (_, index) => {
    const base = hasHeaders && first[index] !== null && first[index] !== undefined ? String(first[index]) : `column_${index + 1}`;
    if (base.length > 256) throw new ParseDataError("Название колонки слишком длинное. Максимум — 256 символов.", 413);
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      const ending = `_${suffix++}`;
      name = `${base.slice(0, 256 - ending.length)}${ending}`;
    }
    used.add(name);
    return name;
  });
  const values = hasHeaders ? rows.slice(1) : rows;
  if (!values.length) throw new ParseDataError("В файле есть заголовки, но нет строк с данными.", 422, "EMPTY_DATA");
  if (values.length > MAX_ROWS) throw new ParseDataError("В таблице больше 50 000 строк.", 413);
  const data: Record<string, CellValue>[] = [];
  const encoder = new TextEncoder();
  let outputBytes = encoder.encode(JSON.stringify({ type: "tabular", data: [], columns, rowCount: values.length })).length;
  for (const row of values) {
    const record = Object.fromEntries(columns.map((name, i) => [name, row[i] ?? null]));
    outputBytes += encoder.encode(JSON.stringify(record)).length + (data.length ? 1 : 0);
    if (outputBytes > MAX_REPORT_BYTES) throw new ParseDataError("Таблица после обработки превышает лимит анализа 2 МБ. Выберите меньше строк или колонок.", 413);
    data.push(record);
  }
  return { type: "tabular", data, columns, rowCount: data.length };
}

export function parseText(text: string): ParseDataResponse {
  const data = cleanText(text);
  if (!data) throw new ParseDataError("Текст пуст. Вставьте текст отчёта.", 422, "EMPTY_DATA");
  if (data.length > 100_000) throw new ParseDataError("Текст слишком длинный для анализа. Максимум — 100 000 символов.", 413);
  const result = { type: "text" as const, data };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_REPORT_BYTES) throw new ParseDataError("Текст после обработки превышает лимит анализа 2 МБ.", 413);
  return result;
}

export function parseFile(bytes: Uint8Array, name: string, headers: HeaderMode): ParseDataResponse {
  if (!bytes.length) throw new ParseDataError("Файл пуст. Выберите файл с данными.", 422, "EMPTY_DATA");
  if (bytes.length > MAX_BYTES) throw new ParseDataError("Файл слишком большой. Максимум — 10 МБ.", 413);
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new ParseDataError("Не удалось прочитать CSV. Сохраните файл в кодировке UTF-8."); }
    if (text.includes("\0")) throw new ParseDataError("CSV содержит бинарные данные. Сохраните таблицу как CSV UTF-8.");
    const result = Papa.parse<string[]>(text, { header: false, dynamicTyping: false, skipEmptyLines: "greedy", preview: MAX_ROWS + 2 });
    if (result.errors.some(error => error.code !== "UndetectableDelimiter")) throw new ParseDataError("CSV повреждён: проверьте кавычки и разделители, затем сохраните файл заново.");
    return normalizeTable(result.data, headers);
  }
  if (extension !== "xlsx" && extension !== "xls") throw new ParseDataError("Поддерживаются только .csv, .xlsx и .xls.", 415);
  // SheetJS also reads arbitrary text; require a genuine Excel container before parsing.
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, i) => bytes[i] === byte);
  if (!(extension === "xlsx" ? zip : ole)) throw new ParseDataError("Файл не похож на Excel или повреждён. Откройте его в Excel и сохраните заново как .xlsx или .xls.");
  try {
    if (zip) checkExcelContainer(bytes);
    const workbook = XLSX.read(bytes, { type: "array", cellDates: true, cellFormula: false, cellHTML: false, sheetRows: MAX_ROWS + 2 });
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet?.["!ref"]) continue;
      const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
      if (range.e.r + 1 > MAX_ROWS + 1 || range.e.c + 1 > MAX_COLUMNS || (range.e.r + 1) * (range.e.c + 1) > MAX_CELLS) throw new ParseDataError("Лист Excel превышает лимит строк или ячеек.", 413);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });
      if (rows.some(row => row.some(value => cell(value) !== null))) return normalizeTable(rows, headers);
    }
    throw new ParseDataError("В книге Excel нет непустых листов.", 422, "EMPTY_DATA");
  } catch (error) {
    if (error instanceof ParseDataError) throw error;
    throw new ParseDataError("Не удалось прочитать Excel: файл повреждён или защищён паролем. Сохраните доступную копию и повторите загрузку.");
  }
}
