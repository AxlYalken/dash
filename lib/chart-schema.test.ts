import { expect, it } from "vitest";
import { resolveCharts, type ChartPlan } from "./chart-schema";
const spec: ChartPlan["charts"][number] = { type: "bar", title: "Продажи", reason: "Сравнение категорий", labelColumn: "name", valueColumn: "value", points: [] };
const plan = (change: Partial<typeof spec> = {}): ChartPlan => ({ charts: [{ ...spec, ...change }], explanation: "" });
it("takes table numbers from source and ignores invented model values", () => {
  const result = resolveCharts(plan({ points: [{ label: "A", value: 999, evidence: "fake" }] }), { type: "tabular", data: [{ name: "A", value: 10 }, { name: "B", value: 20 }, { name: "C", value: null }] });
  expect(result.charts[0].points).toEqual([{ label: "A", value: 10 }, { label: "B", value: 20 }]);
});
it("does not turn strings, booleans or missing cells into zero", () => {
  expect(resolveCharts(plan(), { type: "tabular", data: [{ name: "A", value: "bad" }, { name: "B", value: false }] }).charts).toEqual([]);
});
it("rejects pie charts with negatives and duplicate categories", () => {
  for (const data of [[{ name: "A", value: -1 }, { name: "B", value: 20 }], [{ name: "A", value: 1 }, { name: "A", value: 2 }]]) expect(resolveCharts(plan({ type: "pie" }), { type: "tabular", data }).charts).toEqual([]);
});
it("does not silently truncate large datasets", () => {
  expect(resolveCharts(plan(), { type: "tabular", data: Array.from({ length: 61 }, (_, i) => ({ name: String(i), value: i })) }).charts).toEqual([]);
});
it("accepts quoted text values, including Russian number formatting", () => {
  const result = resolveCharts(plan({ type: "line", labelColumn: null, valueColumn: null, points: [{ label: "Январь", value: 1000, evidence: "Январь: 1 000" }, { label: "Февраль", value: 1200.5, evidence: "Февраль: 1 200,5" }] }), { type: "text", data: "Январь: 1 000; Февраль: 1 200,5" });
  expect(result.charts[0].type).toBe("line");
});
it("rejects ungrounded text numbers", () => {
  expect(resolveCharts(plan({ points: [{ label: "A", value: 999, evidence: "A: 1" }, { label: "B", value: 2, evidence: "B: 2" }] }), { type: "text", data: "A: 1; B: 2" }).charts).toEqual([]);
});
it("renders all three allowed types", () => {
  for (const type of ["bar", "pie", "line"] as const) expect(resolveCharts(plan({ type }), { type: "tabular", data: [{ name: "A", value: 1 }, { name: "B", value: 2 }] }).charts[0].type).toBe(type);
});
