import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWithData } from "./chat-with-data";
const data = { type: "text" as const, data: "Выручка 120. Полный отчёт." };
beforeEach(() => { Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mockStream() {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(c) { source = c; } }), { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } }));
  vi.stubGlobal("fetch", fetcher);
  const send = (value: unknown) => source.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
  return { fetcher, send, end: () => { send({ type: "text-end", id: "text-1" }); send({ type: "finish" }); source.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); source.close(); } };
}
describe("Ask the Data", () => {
  it("disables the composer until a report is loaded", () => {
    render(<ChatWithData data={null} />);
    expect((screen.getByRole("textbox", { name: "Вопрос по данным" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Отправить вопрос" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("sends a suggested question with the full dataset and shows streamed bubbles", async () => {
    const stream = mockStream();
    render(<ChatWithData data={data} suggestedQuestions={["Какова выручка?", "Какой показатель указан?", "Есть ли сравнение?"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Какова выручка?" }));
    await waitFor(() => expect(stream.fetcher).toHaveBeenCalledTimes(1));
    const body = JSON.parse(stream.fetcher.mock.calls[0][1].body);
    expect(body.data).toEqual(data);
    expect(body.messages[0].parts[0].text).toBe("Какова выручка?");
    expect(screen.getByText("печатает…")).toBeTruthy();
    await act(async () => { stream.send({ type: "start", messageId: "answer-1" }); stream.send({ type: "text-start", id: "text-1" }); stream.send({ type: "text-delta", id: "text-1", delta: "Выручка — " }); });
    await waitFor(() => expect(screen.getByText("Выручка —")).toBeTruthy());
    expect(screen.getByText("печатает…")).toBeTruthy();
    await act(async () => { stream.send({ type: "text-delta", id: "text-1", delta: "120." }); stream.end(); });
    await waitFor(() => expect(screen.queryByText("печатает…")).toBeNull());
    expect(screen.getByText("Выручка — 120.")).toBeTruthy();
  });
  it("shows readable HTTP errors and clears history on a dataset remount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "private-provider-details" }, { status: 503 })));
    const { rerender } = render(<ChatWithData key="first" data={data} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Какова выручка?" } }); fireEvent.click(screen.getByRole("button", { name: "Отправить вопрос" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Не удалось получить ответ"));
    expect(screen.getByRole("alert").textContent).not.toContain("private-provider-details");
    rerender(<ChatWithData key="second" data={{ type: "text", data: "Новый отчёт." }} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Какова выручка?")).toBeNull();
  });
});
