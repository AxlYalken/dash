import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./error-boundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("isolates a crashed component and allows recovery", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Child() { if (broken) throw new Error("private details"); return <p>Компонент восстановлен</p>; }
  render(<><p>Другой раздел доступен</p><ErrorBoundary name="тестовый блок"><Child /></ErrorBoundary></>);
  expect(screen.getByText("Другой раздел доступен")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).not.toContain("private details");
  broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(screen.getByText("Компонент восстановлен")).toBeTruthy();
});
