import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Нарратив — главное в ваших данных";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const font = await readFile(join(process.cwd(), "app/fonts/NotoSans-Regular.ttf"));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "76px", background: "#f5f5f5", color: "#171717", fontFamily: "Noto Sans" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", fontSize: 36, fontWeight: 700 }}><div style={{ display: "flex", width: 56, height: 56, borderRadius: 16, background: "#171717", color: "white", alignItems: "center", justifyContent: "center" }}>н.</div>нарратив.</div>
      <div style={{ display: "flex", marginTop: 96, fontSize: 64, fontWeight: 700, letterSpacing: "-3px" }}>Главное в ваших данных.</div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#737373" }}>Выводы ИИ и ответы на вопросы по отчётам.</div>
      <div style={{ display: "flex", marginTop: "auto", gap: 12 }}>{["CSV / Excel", "Главный вывод", "Вопросы по данным"].map(label => <div key={label} style={{ display: "flex", padding: "12px 22px", border: "1px solid #d4d4d4", borderRadius: 24, fontSize: 18 }}>{label}</div>)}</div>
    </div>, { ...size, fonts: [{ name: "Noto Sans", data: font, weight: 400, style: "normal" }] },
  );
}
