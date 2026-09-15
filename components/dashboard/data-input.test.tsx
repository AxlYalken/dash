import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataInput } from "./data-input";
import type { InputZoneProps } from "./input-zone";

vi.mock("./charts-grid", () => ({ ChartsGrid: () => <div>Графики</div> }));
vi.mock("./reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("./input-zone", () => ({ InputZone: ({ onDataReady, disabled }: InputZoneProps) => <button disabled={disabled} onClick={() => onDataReady({ source: "text", text: "Выручка выросла с 100 до 120." })}>Загрузить тестовые данные</button> }));
beforeEach(() => { Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("dashboard insight pipeline", () => {
  it("renders partial model text while the stream is still open", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ type: "text", data: "Выручка выросла с 100 до 120." })).mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { source = c; } })));
    vi.stubGlobal("fetch", fetcher);
    render(<DataInput />);
    fireEvent.click(screen.getByText("Загрузить тестовые данные"));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await act(async () => { source.enqueue(encoder.encode('{"headline":"Рост выручки')); });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Рост выручки" })).toBeTruthy());
    expect(screen.getByText("Нахожу главное…")).toBeTruthy();
    await act(async () => { source.enqueue(encoder.encode('","subtext":"Выручка выросла на 20%. Причина неизвестна.","suggestedQuestions":["Как изменилась выручка?","Какие значения сравниваются?","Каких данных не хватает?"]}')); source.close(); });
    await waitFor(() => expect(screen.getByText("Вывод готов")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Как изменилась выручка?" })).toBeTruthy();
    expect(fetcher.mock.calls[1][0]).toBe("/api/generate-insight");
  });
  it("shows parse errors without calling the LLM endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: "Файл пуст." }, { status: 422 }));
    vi.stubGlobal("fetch", fetcher);
    render(<DataInput />); fireEvent.click(screen.getByText("Загрузить тестовые данные"));
    await waitFor(() => expect(screen.getAllByRole("alert").map(el => el.textContent).join(" ")).toContain("Файл пуст."));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("shows missing-key errors with a retry action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ type: "text", data: "Отчёт" })).mockResolvedValueOnce(Response.json({ error: "Генерация не настроена: добавьте AI_GATEWAY_API_KEY." }, { status: 503 })));
    render(<DataInput />); fireEvent.click(screen.getByText("Загрузить тестовые данные"));
    await waitFor(() => expect(screen.getAllByRole("alert").map(el => el.textContent).join(" ")).toContain("AI_GATEWAY_API_KEY"));
    expect(screen.getAllByRole("button", { name: "Повторить" })[0]).toBeTruthy();
  });
});

it("shows an empty-file state and allows choosing another file", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Файл пуст.", code: "EMPTY_DATA" }, { status: 422 })));
  render(<DataInput />); fireEvent.click(screen.getByText("Загрузить тестовые данные"));
  await waitFor(() => expect(screen.getByText("В файле нет данных")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Попробовать снова" }));
  expect(screen.getByText("Загрузить тестовые данные")).toBeTruthy();
});
it("handles non-JSON proxy responses without rendering raw errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));
  render(<DataInput />); fireEvent.click(screen.getByText("Загрузить тестовые данные"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Сервер вернул нечитаемый ответ"));
  expect(screen.getByRole("alert").textContent).not.toContain("Bad gateway");
});
