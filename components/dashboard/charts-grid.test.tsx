import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChartsGrid } from "./charts-grid";
vi.mock("recharts", async original => {
  const actual = await original<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <div>{(awaitReact.cloneElement(children, { width: 500, height: 280 } as never))}</div> };
});
import * as awaitReact from "react";
beforeEach(() => Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("renders all chart types and accessible source tables", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ charts: ["bar", "pie", "line"].map(type => ({ type, title: `График ${type}`, reason: "Выбор по данным", points: [{ label: "A", value: 10 }, { label: "B", value: 20 }] })), explanation: "" })));
  render(<ChartsGrid data={{ type: "text", data: "A: 10; B: 20" }} />);
  await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(3));
  expect(document.querySelectorAll("svg.recharts-surface").length).toBe(3);
});
it("shows empty data and handles request failure", async () => {
  const { rerender } = render(<ChartsGrid data={null} />);
  expect(screen.getByText(/Загрузите таблицу/)).toBeTruthy();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private")));
  rerender(<ChartsGrid data={{ type: "text", data: "Отчёт" }} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy());
  expect(screen.getByRole("alert").textContent).not.toContain("private");
});
