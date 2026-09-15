"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MotionSurface, StateTransition } from "./motion-surface";
import type { Insight } from "@/lib/insight-schema";

function StreamingText({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{text}</>;
  return <span aria-hidden="true">{(text.match(/\S+\s*/gu) || []).map((word, i) => <span key={i} className="inline-block max-w-full whitespace-pre-wrap [overflow-wrap:anywhere]">{Array.from(word).map((letter, j) => <motion.span key={j} initial={{ opacity: 0, filter: "blur(2px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.3 }}>{letter}</motion.span>)}</span>)}</span>;
}

export interface HeroInsightWidgetProps {
  insight?: Partial<Pick<Insight, "headline" | "subtext">>;
  isLoading?: boolean;
  isParsing?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function HeroInsightWidget({ insight, isLoading = false, isParsing = false, error, onRetry }: HeroInsightWidgetProps) {
  const busy = isLoading || isParsing;
  return (
    <section aria-labelledby="insight-title" lang="ru" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-4 -z-10 rounded-full bg-foreground/5 blur-3xl" />
      <MotionSurface className="overflow-hidden border-foreground/10 bg-card/60 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/5 px-4 py-4 sm:px-6 sm:py-5">
          <h2 id="insight-title" className="flex items-center gap-2.5 text-base font-medium"><Sparkles className="size-4" aria-hidden="true" /> Главный вывод</h2>
          <span role="status" className="text-[11px] text-muted-foreground">{error ? "Нужна повторная попытка" : isParsing ? "Разбираю данные…" : isLoading ? "Нахожу главное…" : insight?.headline ? "Вывод готов" : "В ожидании данных"}</span>
        </div>
        <div className="min-h-60 p-4 py-6 sm:p-6 sm:py-8">
          <StateTransition stateKey={error ? "error" : insight?.headline ? "content" : busy ? "loading" : "empty"}>
          {error ? <div role="alert" className="flex flex-col items-start gap-4"><AlertCircle className="size-5 text-muted-foreground" aria-hidden="true" /><p className="text-sm leading-relaxed">{error}</p>{onRetry && <Button variant="outline" onClick={onRetry} disabled={busy}>Повторить</Button>}</div> : (
            <>
              {insight?.headline ? <h3 aria-label={insight.headline} className="max-w-3xl break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"><StreamingText text={insight.headline} /></h3> : busy ? <Skeleton className="h-10 w-3/4" /> : <h3 className="text-2xl font-medium tracking-tight">За цифрами — главное.</h3>}
              {insight?.subtext ? <p aria-label={insight.subtext} className="mt-5 max-w-3xl break-words text-base leading-relaxed text-muted-foreground sm:text-lg"><StreamingText text={insight.subtext} /></p> : busy ? <div aria-hidden="true" className="mt-6 space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div> : <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Загрузите таблицу или вставьте отчёт. Здесь появится главное наблюдение, подкреплённое вашими данными.</p>}
              {isLoading && <span aria-hidden="true" className="mt-5 inline-block size-1.5 animate-pulse rounded-full bg-foreground/50 motion-reduce:animate-none" />}
            </>
          )}
          </StateTransition>
        </div>
      </MotionSurface>
    </section>
  );
}
