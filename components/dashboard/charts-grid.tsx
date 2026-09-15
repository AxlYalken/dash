"use client";

import { useEffect, useId, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeedbackState } from "./feedback-state";
import { MotionSurface } from "./motion-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { chartViewResponseSchema, type ChartView, type ChartsResponse } from "@/lib/chart-schema";
import type { InsightInput } from "@/lib/insight-schema";

const colors = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#38bdf8", "#a78bfa", "#84cc16", "#f97316"];
const format = (value: number) => new Intl.NumberFormat("ru-RU", { maximumSignificantDigits: 21, notation: Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-4) ? "scientific" : "standard" }).format(value);
const short = (value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value;
const types = { bar: "Столбчатая диаграмма", pie: "Круговая диаграмма", line: "Линейный график" };

function ChartCard({ chart }: { chart: ChartView }) {
  const reduced = useReducedMotion();
  const id = useId();
  const [selected, setSelected] = useState("");
  const [sorted, setSorted] = useState(false);
  const points = sorted && chart.type === "bar" ? [...chart.points].sort((a, b) => b.value - a.value) : chart.points;
  const chosen = points.find(point => point.label === selected);
  const maximum = points.reduce((best, point) => point.value > best.value ? point : best);
  const displayed = chosen || maximum;
  const tooltip = <Tooltip cursor={{ stroke: "hsl(var(--border))", fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={value => format(Number(value))} />;
  const xAxis = <XAxis dataKey="label" axisLine={false} tickLine={false} tickFormatter={short} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={30} dy={8} />;
  const yAxis = <YAxis axisLine={false} tickLine={false} width={44} tickCount={3} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={value => new Intl.NumberFormat("ru-RU", { notation: "compact" }).format(value)} />;
  return <MotionSurface className="min-w-0 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{types[chart.type]}</p><span className="text-[10px] text-muted-foreground">{points.length} знач.</span></div>
    <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5" title={chart.title}>{chart.title}</h3>
    <div className="mt-3"><p className="text-2xl font-semibold tracking-tight tabular-nums">{format(displayed.value)}</p><p className="mt-1 truncate text-[11px] text-muted-foreground" title={displayed.label}>{chosen ? "Выбрано" : "Максимум"} · {displayed.label}</p></div>
    <div className="mt-4 h-48 min-w-0" role="img" aria-label={`${types[chart.type]}: ${chart.title}. Выберите категорию ниже или наведите на график.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {chart.type === "pie" ? <PieChart>{tooltip}<Pie data={points} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none" isAnimationActive={!reduced} onClick={(_, index) => setSelected(points[index]?.label || "")}>{points.map((point, i) => <Cell key={point.label} fill={colors[i % colors.length]} opacity={!selected || selected === point.label ? 1 : 0.25} />)}</Pie></PieChart> : chart.type === "line" ? <LineChart data={points} margin={{ top: 12, right: 10, bottom: 12, left: 0 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 5" />{xAxis}{yAxis}{tooltip}<Line type="linear" dataKey="value" name={chart.title} stroke={colors[0]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={!reduced} />{chosen && <ReferenceDot x={chosen.label} y={chosen.value} r={5} fill={colors[0]} stroke="hsl(var(--card))" />}</LineChart> : <BarChart data={points} margin={{ top: 12, right: 10, bottom: 12, left: 0 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 5" />{xAxis}{yAxis}{tooltip}<Bar dataKey="value" name={chart.title} fill={colors[0]} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!reduced} onClick={(_, index) => setSelected(points[index]?.label || "")}>{points.map(point => <Cell key={point.label} opacity={!selected || selected === point.label ? 0.85 : 0.2} />)}</Bar></BarChart>}
      </ResponsiveContainer>
    </div>
    <div className="mt-4 flex min-w-0 items-center gap-2 border-t pt-3">
      <label htmlFor={id} className="sr-only">Категория: {chart.title}</label>
      <select id={id} value={selected} onChange={event => setSelected(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Все категории</option>{points.map(point => <option key={point.label} value={point.label}>{point.label}</option>)}</select>
      {chart.type === "bar" && <button type="button" aria-pressed={sorted} onClick={() => setSorted(value => !value)} className="h-8 shrink-0 rounded-lg border px-2 text-[11px] text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{sorted ? "Исходный порядок" : "По значению"}</button>}
    </div>
    <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Подробнее и данные</summary><p className="my-3 leading-relaxed text-muted-foreground">{chart.reason}</p><div className="max-h-48 overflow-auto"><table className="w-full text-left"><caption className="sr-only">{chart.title}</caption><thead><tr><th className="p-2">Категория</th><th className="p-2">Значение</th></tr></thead><tbody>{points.map(point => <tr key={point.label} className="border-t"><td className="max-w-40 break-words p-2">{point.label}</td><td className="p-2 tabular-nums">{format(point.value)}</td></tr>)}</tbody></table></div></details>
  </MotionSurface>;
}

export function ChartsGrid({ data }: { data: InsightInput | null }) {
  const [result, setResult] = useState<ChartsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null); setError(null);
    if (!data) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 55_000);
    void (async () => {
      try {
        const response = await fetch("/api/generate-charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error("request");
        const parsed = chartViewResponseSchema.safeParse(body);
        if (!parsed.success) throw new Error("invalid charts");
        if (active) setResult(parsed.data);
      } catch {
        if (active) setError(timedOut ? "Модель не успела подготовить графики. Повторите попытку." : "Не удалось построить графики. Проверьте доступ к модели и попробуйте ещё раз.");
      } finally { clearTimeout(timer); if (active) setLoading(false); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [data, attempt]);
  return <section aria-labelledby="charts-title">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="charts-title" className="section-label">02 <span className="ml-2 text-foreground">Графики</span></h2><span className="text-xs text-muted-foreground">Тип диаграммы выбирает ИИ</span></div>
    {!data ? <FeedbackState kind="empty" message="Загрузите таблицу или текстовый отчёт с числовыми показателями." /> : loading ? <div role="status" className="surface-card p-6"><p className="mb-5 text-sm text-muted-foreground">ИИ выбирает подходящие графики…</p><Skeleton className="h-60 w-full rounded-xl" /></div> : error ? <FeedbackState title="Не удалось подготовить визуализации" message={error} onRetry={() => setAttempt(value => value + 1)} /> : result?.charts.length ? <><div className={`grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 ${result.charts.length === 3 ? "xl:grid-cols-3" : ""}`}>{result.charts.map((chart, i) => <ChartCard key={i} chart={chart} />)}</div>{result.explanation && <p className="mt-3 text-sm text-muted-foreground">{result.explanation}</p>}</> : <FeedbackState kind="empty" message={result?.explanation || "Для графика нужны хотя бы два сопоставимых числовых значения с подписями."} />}
  </section>;
}
