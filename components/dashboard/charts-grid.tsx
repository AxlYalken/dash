"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeedbackState } from "./feedback-state";
import { MotionSurface } from "./motion-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { chartViewResponseSchema, type ChartView, type ChartsResponse } from "@/lib/chart-schema";
import type { InsightInput } from "@/lib/insight-schema";

const colors = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#38bdf8", "#a78bfa", "#84cc16", "#f97316"];
const format = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const short = (value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value;
const types = { bar: "Столбчатая диаграмма", pie: "Круговая диаграмма", line: "Линейный график" };

function ChartCard({ chart }: { chart: ChartView }) {
  const reduced = useReducedMotion();
  const tooltip = <Tooltip contentStyle={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={value => format(Number(value))} />;
  return <MotionSurface className="min-w-0 p-4 sm:p-6">
    <p className="text-xs text-muted-foreground">{types[chart.type]} · выбор ИИ</p>
    <h3 className="mt-2 break-words text-lg font-medium">{chart.title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{chart.reason}</p>
    <div className="mt-5 h-72 min-w-0" role="img" aria-label={`${types[chart.type]}: ${chart.title}. Числа доступны в таблице ниже.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {chart.type === "pie" ? <PieChart>{tooltip}<Pie data={chart.points} dataKey="value" nameKey="label" innerRadius="42%" outerRadius="82%" isAnimationActive={!reduced}>{chart.points.map((p, i) => <Cell key={p.label} fill={colors[i % colors.length]} />)}</Pie></PieChart> : chart.type === "line" ? <LineChart data={chart.points} margin={{ top: 12, right: 12, bottom: 16, left: 0 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="label" tickFormatter={short} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={24} /><YAxis width={64} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={value => new Intl.NumberFormat("ru-RU", { notation: "compact" }).format(value)} />{tooltip}<Line type="linear" dataKey="value" name={chart.title} stroke={colors[0]} strokeWidth={2.5} dot={chart.points.length <= 15} isAnimationActive={!reduced} /></LineChart> : <BarChart data={chart.points} margin={{ top: 12, right: 12, bottom: 16, left: 0 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="label" tickFormatter={short} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={24} /><YAxis width={64} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={value => new Intl.NumberFormat("ru-RU", { notation: "compact" }).format(value)} />{tooltip}<Bar dataKey="value" name={chart.title} fill={colors[0]} radius={[5, 5, 0, 0]} isAnimationActive={!reduced} /></BarChart>}
      </ResponsiveContainer>
    </div>
    {chart.type === "pie" && <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{chart.points.map((p, i) => <li key={p.label} className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} /><span className="break-all">{p.label}: {format(p.value)}</span></li>)}</ul>}
    <details className="mt-4 text-xs"><summary className="cursor-pointer text-muted-foreground">Показать данные графика</summary><div className="mt-3 max-h-60 overflow-auto"><table className="w-full text-left"><caption className="sr-only">{chart.title}</caption><thead><tr><th className="p-2">Категория</th><th className="p-2">Значение</th></tr></thead><tbody>{chart.points.map(p => <tr key={p.label} className="border-t"><td className="max-w-48 break-words p-2">{p.label}</td><td className="p-2 tabular-nums">{format(p.value)}</td></tr>)}</tbody></table></div></details>
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
    {!data ? <FeedbackState kind="empty" message="Загрузите таблицу или текстовый отчёт с числовыми показателями." /> : loading ? <div role="status" className="surface-card p-6"><p className="mb-5 text-sm text-muted-foreground">ИИ выбирает подходящие графики…</p><Skeleton className="h-60 w-full rounded-xl" /></div> : error ? <FeedbackState title="Не удалось подготовить визуализации" message={error} onRetry={() => setAttempt(value => value + 1)} /> : result?.charts.length ? <><div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">{result.charts.map((chart, i) => <ChartCard key={i} chart={chart} />)}</div>{result.explanation && <p className="mt-3 text-sm text-muted-foreground">{result.explanation}</p>}</> : <FeedbackState kind="empty" message={result?.explanation || "Для графика нужны хотя бы два сопоставимых числовых значения с подписями."} />}
  </section>;
}
