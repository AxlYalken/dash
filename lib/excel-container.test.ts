// @vitest-environment node
import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import { checkExcelContainer } from "./excel-container";
import { parseFile, parseText } from "./parse-data";
import { insightSchema, validInsight } from "./insight-schema";

function book(compression = false) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["name", "value"], ["Test", 12]]), "Data");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression }) as Buffer;
}
it.each([false, true])("accepts valid Excel ZIP, compression=%s", compression => {
  expect(() => checkExcelContainer(book(compression))).not.toThrow();
  expect(parseFile(book(compression), "data.xlsx", true).type).toBe("tabular");
});
it("rejects declared oversized expansion before SheetJS", () => {
  const bytes = book();
  const pos = bytes.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
  bytes.writeUInt32LE(128 * 1024 * 1024, pos + 24);
  expect(() => checkExcelContainer(bytes)).toThrow();
});
it("rejects forged expansion sizes even if local and central headers match", () => {
  const bytes = book(true);
  const pos = bytes.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
  const local = bytes.readUInt32LE(pos + 42);
  bytes.writeUInt32LE(1, pos + 24); bytes.writeUInt32LE(1, local + 22);
  expect(() => checkExcelContainer(bytes)).toThrow();
});
it("rejects truncated containers", () => {
  expect(() => checkExcelContainer(book().subarray(0, 100))).toThrow();
});
it("rejects wide CSV before normalizing cells", () => {
  expect(() => parseFile(new TextEncoder().encode(Array(501).fill("x").join(",")), "data.csv", false)).toThrow(/лимит/);
});
it("rejects text exceeding the downstream analysis limit", () => {
  expect(() => parseText("a".repeat(100001))).toThrow(/100 000/);
});
it("rejects blank model headlines", () => {
  const value = { headline: "   ", subtext: "Первое предложение. Второе предложение.", suggestedQuestions: ["Один?", "Два?", "Три?"] };
  expect(insightSchema.safeParse(value).success).toBe(false);
  expect(validInsight(value)).toBe(false);
});

it("rejects corrupted ZIP payloads with unchanged sizes", () => {
 const bytes = book(false);
 const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 1, 2]));
 const offset = bytes.readUInt32LE(central + 42);
 const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
 bytes[start] ^= 1;
 expect(() => checkExcelContainer(bytes)).toThrow();
});
