// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { POST } from "./route";

const url = "http://localhost/api/parse-data";
async function fileRequest(content: BlobPart, name = "data.csv", headers?: boolean) {
  const form = new FormData();
  form.append("file", new Blob([content]), name);
  if (headers !== undefined) form.append("hasHeaders", String(headers));
  const response = await POST(new Request(url, { method: "POST", body: form }));
  return { status: response.status, body: await response.json() };
}
function workbook(rows: unknown[][], bookType: "xlsx" | "xls" = "xlsx") {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Data");
  return XLSX.write(book, { type: "buffer", bookType });
}

describe("POST /api/parse-data", () => {
  it("parses CSV with BOM, semicolon separators, quoted cells and mixed types", async () => {
    const { status, body } = await fileRequest('\uFEFFname;value;active\r\n"Аня; Иванова";12;true\r\nБорис;нет;false\r\nВера;;\r\n');
    expect(status).toBe(200);
    expect(body).toEqual({ type: "tabular", columns: ["name", "value", "active"], rowCount: 3, data: [
      { name: "Аня; Иванова", value: 12, active: true }, { name: "Борис", value: "нет", active: false }, { name: "Вера", value: null, active: null },
    ] });
  });
  it("retains headerless rows and generates column names", async () => {
    const { body } = await fileRequest("Alice,12\nBob,18");
    expect(body.columns).toEqual(["column_1", "column_2"]);
    expect(body.data).toEqual([{ column_1: "Alice", column_2: 12 }, { column_1: "Bob", column_2: 18 }]);
  });
  it("keeps ambiguous all-text rows unless headers are explicitly requested", async () => {
    const input = "name,city\nAlice,Paris\nBob,Rome";
    expect((await fileRequest(input)).body.rowCount).toBe(3);
    expect((await fileRequest(input, "data.csv", true)).body.columns).toEqual(["name", "city"]);
    expect((await fileRequest(input, "data.csv", false)).body.rowCount).toBe(3);
  });
  it("handles blank and duplicate headers, ragged rows and special object keys", async () => {
    const { body } = await fileRequest("name,name,,__proto__\na,b,3,safe,extra\nc", "data.csv", true);
    expect(body.columns).toEqual(["name", "name_2", "column_3", "__proto__", "column_5"]);
    expect(body.data[0]["__proto__"]).toBe("safe");
    expect(body.data[1]).toEqual(JSON.parse('{"name":"c","name_2":null,"column_3":null,"__proto__":null,"column_5":null}'));
  });
  it("preserves leading zeros and large numbers as strings", async () => {
    const { body } = await fileRequest("id,value\n00123,9007199254740993", "data.csv", true);
    expect(body.data[0]).toEqual({ id: "00123", value: "9007199254740993" });
  });
  it("accepts single-column CSV", async () => {
    const { body } = await fileRequest("score\n10\n20");
    expect(body.data).toEqual([{ score: 10 }, { score: 20 }]);
  });
  it.each(["", " \n,\n", 'a,b\n"broken,12'])('returns readable errors for empty or malformed CSV: %j', async input => {
    const { status, body } = await fileRequest(input);
    expect(status).toBe(422);
    expect(body.data).toEqual([]);
    expect(body.error).toEqual(expect.any(String));
  });
  it("rejects header-only files when headers are explicit", async () => {
    expect((await fileRequest("name,age", "data.csv", true)).status).toBe(422);
  });
  it("rejects binary CSV and invalid UTF-8", async () => {
    expect((await fileRequest(new Uint8Array([1, 0, 2]))).status).toBe(422);
    expect((await fileRequest(new Uint8Array([0xff, 0xff]))).status).toBe(422);
  });
  it.each(["xlsx", "xls"] as const)("parses real %s workbooks with mixed cells", async extension => {
    const { status, body } = await fileRequest(workbook([["name", "value"], ["Alice", 12], ["Bob", "n/a"], ["Carol", null]], extension), `report.${extension}`);
    expect(status).toBe(200);
    expect(body.data).toEqual([{ name: "Alice", value: 12 }, { name: "Bob", value: "n/a" }, { name: "Carol", value: null }]);
  });
  it("uses the first nonempty Excel sheet", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), "Empty");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[1, 2], [3, 4]]), "Values");
    const { body } = await fileRequest(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), "data.xlsx");
    expect(body.rowCount).toBe(2);
    expect(body.data[0]).toEqual({ column_1: 1, column_2: 2 });
  });
  it("rejects empty, fake and truncated Excel files", async () => {
    expect((await fileRequest(workbook([]), "empty.xlsx")).status).toBe(422);
    expect((await fileRequest("some plain text", "fake.xlsx")).status).toBe(422);
    expect((await fileRequest(new Uint8Array([0x50, 0x4b, 3, 4, 0]), "broken.xlsx")).status).toBe(422);
  });
  it("returns cleaned text via JSON, plain body and multipart", async () => {
    const text = "\uFEFF  Отчёт\r\n\r\n Выручка\t  12\u0000 \n \n";
    const form = new FormData(); form.append("text", text);
    for (const request of [
      new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }),
      new Request(url, { method: "POST", headers: { "content-type": "text/plain" }, body: text }),
      new Request(url, { method: "POST", body: form }),
    ]) {
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ type: "text", data: "Отчёт\nВыручка 12" });
    }
  });
  it("rejects missing text, wrong types, invalid JSON and whitespace", async () => {
    for (const input of ["{", "{}", '{"text":12}', '{"text":"  "}']) {
      const response = await POST(new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: input }));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect((await response.json()).error).toEqual(expect.any(String));
    }
  });
  it("rejects multiple sources, malformed forms and unsupported formats", async () => {
    const form = new FormData(); form.append("file", new Blob(["a,b"]), "a.csv"); form.append("text", "text");
    expect((await POST(new Request(url, { method: "POST", body: form }))).status).toBe(400);
    expect((await POST(new Request(url, { method: "POST", headers: { "content-type": "multipart/form-data" }, body: "bad" }))).status).toBe(400);
    expect((await fileRequest("content", "data.pdf")).status).toBe(415);
  });
  it("rejects oversized request bodies and overly wide tables", async () => {
    const response = await POST(new Request(url, { method: "POST", headers: { "content-type": "text/plain", "content-length": "20000000" }, body: "text" }));
    expect(response.status).toBe(413);
    expect((await fileRequest(Array(501).fill("1").join(","))).status).toBe(413);
  });
});

it("returns an explicit empty-data code", async () => {
  const { body } = await fileRequest("");
  expect(body.code).toBe("EMPTY_DATA");
});
