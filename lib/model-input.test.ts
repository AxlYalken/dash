import { expect, it } from "vitest";
import { modelInput } from "./model-input";
import { parseFile } from "./parse-data";
import { insightInputSchema } from "./insight-schema";

it("retains all rows and values while sending column names only once", () => {
  const result = modelInput({ type: "tabular", data: [{ name: "A", value: 0 }, { name: "B", value: null, flag: false }], columns: ["fake"], rowCount: 999 });
  expect(result).toMatchObject({ columns: ["name", "value", "flag"], rowCount: 2, rows: [["A", 0, null], ["B", null, false]] });
});
it("accepts a 2207-row, 18-column report larger than the old 512 KB budget", () => {
  const headers = Array.from({ length: 18 }, (_, i) => `Показатель_${i}`);
  const csv = [headers.join(","), ...Array.from({ length: 2207 }, (_, i) => headers.map((_, j) => i + j).join(","))].join("\n");
  const result = parseFile(new TextEncoder().encode(csv), "report.csv", true);
  expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeGreaterThan(512 * 1024);
  expect(insightInputSchema.safeParse(result).success).toBe(true);
  expect(result).toMatchObject({ rowCount: 2207 });
  const compact = modelInput(insightInputSchema.parse(result));
  expect(compact).toMatchObject({ rowCount: 2207 });
  if ("rows" in compact) expect(compact.rows[2206][17]).toBe(2223);
});
it("still rejects normalized tables over 2 MB", () => {
  const header = "h".repeat(200);
  const csv = header + "\n" + Array(11000).fill("123").join("\n");
  expect(() => parseFile(new TextEncoder().encode(csv), "report.csv", true)).toThrow(/2 МБ/);
});

it("does not expand sparse input into a huge rectangular matrix", () => {
 const data = Array.from({ length: 3000 }, (_, i) => ({ [`column_${i % 500}`]: i }));
 const result = modelInput({ type: "tabular", data });
 expect(result).not.toHaveProperty("rows");
 expect(result).toMatchObject({ rowCount: 3000, data });
});
