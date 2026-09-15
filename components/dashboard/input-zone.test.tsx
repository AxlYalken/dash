import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputZone } from "./input-zone";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockImplementation(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });

async function drop(files: File[]) {
  await act(async () => {
    fireEvent.drop(screen.getByRole("button", { name: "Выбрать или перетащить CSV или Excel файл" }), {
      dataTransfer: { files, items: files.map(file => ({ kind: "file", type: file.type, getAsFile: () => file })), types: ["Files"] },
    });
  });
}

function enterText(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "Вставить текст" }));
  fireEvent.change(screen.getByLabelText("Текст отчёта"), { target: { value } });
}

describe("InputZone", () => {
  it("processes text through progress stages and calls back exactly once after two seconds", () => {
    const ready = vi.fn();
    render(<InputZone onDataReady={ready} />);
    enterText("  Выручка выросла на 15%.  ");
    fireEvent.click(screen.getByRole("button", { name: "Обработать текст" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("8");
    expect((screen.getByRole("button", { name: "Загрузить файл" }) as HTMLButtonElement).disabled).toBe(true);
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toContain("Анализирую структуру");
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toContain("Готовлю выводы");
    act(() => vi.advanceTimersByTime(699));
    expect(ready).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(ready).toHaveBeenCalledExactlyOnceWith({ source: "text", text: "Выручка выросла на 15%." });
    expect(screen.queryByRole("progressbar")).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it.each(["report.csv", "report.xlsx", "report.xls", "REPORT.CSV"])("accepts %s even without a MIME type and returns the original File", async name => {
    const ready = vi.fn();
    render(<InputZone onDataReady={ready} />);
    const file = new File(["a,b\n1,2"], name);
    await drop([file]);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(ready).toHaveBeenCalledExactlyOnceWith({ source: "file", file });
  });

  it("rejects invalid extensions even when MIME claims CSV and recovers for a valid file", async () => {
    const ready = vi.fn();
    render(<InputZone onDataReady={ready} />);
    await drop([new File(["text"], "report.pdf", { type: "text/csv" })]);
    expect(screen.getByRole("alert").textContent).toContain("Этот формат не поддерживается");
    act(() => vi.advanceTimersByTime(3000));
    expect(ready).not.toHaveBeenCalled();
    const file = new File(["a,b"], "valid.csv", { type: "text/csv" });
    await drop([file]);
    act(() => vi.advanceTimersByTime(2000));
    expect(ready).toHaveBeenCalledExactlyOnceWith({ source: "file", file });
  });

  it("rejects multiple files without starting processing", async () => {
    const ready = vi.fn();
    render(<InputZone onDataReady={ready} />);
    await drop([new File(["1"], "a.csv"), new File(["2"], "b.xls")]);
    expect(screen.getByRole("alert").textContent).toContain("один файл");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(ready).not.toHaveBeenCalled();
  });

  it("disables submission for whitespace and preserves draft when switching modes", () => {
    render(<InputZone onDataReady={vi.fn()} />);
    enterText("   ");
    expect((screen.getByRole("button", { name: "Обработать текст" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Текст отчёта"), { target: { value: "Мой отчёт" } });
    fireEvent.click(screen.getByRole("button", { name: "Загрузить файл" }));
    fireEvent.click(screen.getByRole("button", { name: "Вставить текст" }));
    expect((screen.getByLabelText("Текст отчёта") as HTMLTextAreaElement).value).toBe("Мой отчёт");
  });

  it("cleans up processing timers on unmount", () => {
    const ready = vi.fn();
    const { unmount } = render(<InputZone onDataReady={ready} />);
    enterText("Отчёт");
    fireEvent.click(screen.getByRole("button", { name: "Обработать текст" }));
    act(() => vi.advanceTimersByTime(700));
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(ready).not.toHaveBeenCalled();
  });
});
