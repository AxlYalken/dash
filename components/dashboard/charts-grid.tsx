"use client";

import { FeedbackState } from "./feedback-state";
import { BarChart3, ChartNoAxesCombined, Donut } from "lucide-react";
import { MotionSurface } from "./motion-surface";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const placeholders = [
  { title: "Динамика", description: "Как меняются показатели со временем", icon: ChartNoAxesCombined },
  { title: "Состав", description: "Доли категорий в общей картине", icon: Donut },
  { title: "Сравнение", description: "Различия между показателями", icon: BarChart3 },
];

export function ChartsGrid({ error, onRetry, disabled = false, empty = false }: { error?: string | null; onRetry?: () => void; disabled?: boolean; empty?: boolean }) {
  return (
    <section aria-labelledby="charts-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="charts-title" className="section-label">02 <span className="ml-2 text-foreground">Графики</span></h2><span className="text-xs text-muted-foreground">Данные подробнее</span></div>
      {error ? <FeedbackState title="Не удалось подготовить визуализации" message={error} onRetry={onRetry} disabled={disabled} /> : empty ? <FeedbackState kind="empty" message="Загрузите таблицу с показателями, чтобы подготовить данные для графиков." /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {placeholders.map(({ title, description, icon: Icon }) => (
          <MotionSurface key={title}>
            <CardHeader className="px-5 pb-0 pt-5"><CardTitle className="text-sm font-medium">{title}</CardTitle><p className="text-xs text-muted-foreground">{description}</p></CardHeader>
            <CardContent className="flex h-40 flex-col items-center justify-center gap-3 px-5"><Icon className="size-7 text-muted-foreground/35" strokeWidth={1.25} aria-hidden="true" /><p className="text-xs text-muted-foreground">Здесь появится график</p></CardContent>
          </MotionSurface>
        ))}
      </div>}
    </section>
  );
}
