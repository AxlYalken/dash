// @vitest-environment node
import { expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
const generate = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject: generate }));
vi.mock("@/lib/ai-model", () => ({ aiConfigurationError: () => null, getAIModel: () => "test" }));
const request = (data: unknown) => new Request("http://localhost/api/generate-charts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
beforeEach(() => { generate.mockReset(); });
it("resolves an AI plan against actual table data", async () => {
  generate.mockResolvedValue({ object: { charts: [{ type: "bar", title: "Значения", reason: "Сравнение", labelColumn: "name", valueColumn: "value", points: [] }], explanation: "" } });
  const response = await POST(request({ type: "tabular", data: [{ name: "A", value: 10 }, { name: "B", value: 20 }] }));
  expect(response.status).toBe(200);
  expect((await response.json()).charts[0].points[1].value).toBe(20);
});
it("rejects invalid input before model invocation", async () => {
  expect((await POST(request({ type: "bad" }))).status).toBe(400);
  expect(generate).not.toHaveBeenCalled();
});
it("sanitizes model failures", async () => {
  generate.mockRejectedValue(new Error("private-key"));
  const response = await POST(request({ type: "text", data: "Отчёт" }));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-key");
});

it("recomputes metadata before passing the report to the model", async () => {
 generate.mockResolvedValue({ object: { charts: [], explanation: "Нет графиков" } });
 await POST(request({ type: "tabular", data: [{ name: "A", value: 10 }], columns: ["fake"], rowCount: 999 }));
 const input = JSON.parse(generate.mock.calls[0][0].prompt);
 expect(input.columns).toEqual(["name", "value"]);
 expect(input.rowCount).toBe(1);
});
