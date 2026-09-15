"use client";

import { AlertCircle, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeedbackState({ kind = "error", title, message, onRetry, action = "Повторить", disabled = false }: { kind?: "error" | "empty"; title?: string; message: string; onRetry?: () => void; action?: string; disabled?: boolean }) {
  const Icon = kind === "empty" ? FileSearch : AlertCircle;
  return <div role={kind === "error" ? "alert" : "status"} lang="ru" className="flex min-h-40 flex-col items-start justify-center gap-3 rounded-2xl border border-border bg-muted/30 p-5">
    <span className="flex size-10 items-center justify-center rounded-xl bg-card"><Icon className="size-5 text-muted-foreground" aria-hidden="true" /></span>
    <p className="text-sm font-medium">{title || (kind === "empty" ? "Пока нет данных" : "Не удалось завершить действие")}</p>
    <p className="max-w-xl break-words text-sm leading-relaxed text-muted-foreground">{message}</p>
    {onRetry && <Button type="button" variant="outline" disabled={disabled} onClick={onRetry}>{action}</Button>}
  </div>;
}
