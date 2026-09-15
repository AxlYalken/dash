"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { AlertCircle, AlignLeft, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MotionSurface, StateTransition } from "./motion-surface";
import type { InputData } from "@/lib/input-data";

export type { InputData } from "@/lib/input-data";

export interface InputZoneProps {
  onDataReady: (data: InputData) => void;
  disabled?: boolean;
  onProcessingStart?: () => void;
}

const ACCEPTED_FILES = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};
const STAGES = ["Читаю файл…", "Анализирую структуру…", "Готовлю выводы…"];

export function InputZone({ onDataReady, disabled = false, onProcessingStart }: InputZoneProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<InputData | null>(null);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busy = useRef(false);
  const onReady = useRef(onDataReady);
  const processing = pending !== null;

  useEffect(() => { onReady.current = onDataReady; }, [onDataReady]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  function processData(data: InputData) {
    if (busy.current || disabled) return;
    busy.current = true;
    onProcessingStart?.();
    timers.current.forEach(clearTimeout);
    setError(null);
    setPending(data);
    setStage(0);
    setProgress(8);
    timers.current = [
      setTimeout(() => { setStage(1); setProgress(42); }, 650),
      setTimeout(() => { setStage(2); setProgress(76); }, 1300),
      setTimeout(() => { setProgress(100); }, 1800),
      setTimeout(() => {
        busy.current = false;
        setPending(null);
        onReady.current(data);
      }, 2000),
    ];
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject, isFocused } = useDropzone({
    accept: ACCEPTED_FILES,
    multiple: false,
    maxSize: 4 * 1024 * 1024,
    disabled: processing || disabled,
    // MIME types can be missing or misleading; enforce the actual extension too.
    validator: (file) => /\.(csv|xlsx|xls)$/i.test(file.name)
      ? null
      : { code: "file-invalid-type", message: "Поддерживаются только CSV и Excel (.csv, .xlsx, .xls)." },
    onDrop: (files, rejections) => {
      if (busy.current || disabled) return;
      if (rejections.length) {
        const tooMany = rejections.some(({ errors }) => errors.some(({ code }) => code === "too-many-files"));
        const tooLarge = rejections.some(({ errors }) => errors.some(({ code }) => code === "file-too-large"));
        setError(tooLarge ? "Файл слишком большой. Для загрузки на Netlify выберите файл до 4 МБ." : tooMany ? "Выберите один файл за раз." : "Этот формат не поддерживается. Выберите файл .csv, .xlsx или .xls.");
        return;
      }
      if (files[0]) processData({ source: "file", file: files[0] });
    },
    onError: () => setError("Не удалось открыть файл. Попробуйте выбрать его ещё раз."),
  });

  const stageText = stage === 0 && pending?.source === "text" ? "Читаю текст…" : STAGES[stage];

  return (
    <section aria-labelledby={`${id}-title`} lang="ru">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="section-label">01 <span className="ml-2 text-foreground">Загрузка данных</span></h2>
        <span className="text-xs text-muted-foreground">Начните со своих данных</span>
      </div>
      <MotionSurface className="surface-padding">
        <div role="group" aria-label="Источник данных" className="mb-4 inline-flex w-full max-w-full gap-1 sm:w-auto rounded-xl bg-muted p-1">
          {([{ value: "file", label: "Загрузить файл", icon: Upload }, { value: "text", label: "Вставить текст", icon: AlignLeft }] as const).map(({ value, label, icon: Icon }) => (
            <Button key={value} type="button" variant="ghost" disabled={processing || disabled} aria-pressed={mode === value} aria-controls={`${id}-content`} onClick={() => { setMode(value); setError(null); }} className={cn("min-w-0 flex-1 gap-1.5 rounded-lg px-2 text-[11px] sm:flex-none sm:gap-2 sm:px-3 sm:text-sm", mode === value && "bg-card shadow-sm hover:bg-card")}><Icon className="size-4" aria-hidden="true" />{label}</Button>
          ))}
        </div>

        <div id={`${id}-content`} aria-busy={processing}>
          <StateTransition stateKey={processing ? "processing" : mode}>
          {processing ? (
            <div className="min-h-52 rounded-2xl border bg-background/60 p-5 sm:p-6">
              <p className="mb-4 truncate text-xs text-muted-foreground">{pending.source === "file" ? pending.file.name : "Вставленный текст"}</p>
              <div role="status" aria-live="polite" aria-atomic="true" className="mb-5 h-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={stageText} initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -5 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} className="text-sm font-medium">{stageText}</motion.p>
                </AnimatePresence>
              </div>
              <div aria-hidden="true" className="mb-5 space-y-2.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /></div>
              <div role="progressbar" aria-label="Обработка данных" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${stageText} ${progress}%`} className="h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="h-full rounded-full bg-primary" />
              </div>
              <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground"><span>Демонстрация обработки · около 2 секунд</span><span>{progress}%</span></div>
            </div>
          ) : mode === "file" ? (
            <div {...getRootProps({ role: "button", "aria-label": "Выбрать или перетащить CSV или Excel файл", "aria-describedby": `${id}-formats`, className: cn("flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/20 bg-background/60 px-5 py-7 text-center transition-colors motion-reduce:transition-none", "hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-none", isFocused && "ring-2 ring-ring ring-offset-2 ring-offset-card", isDragActive && "border-primary bg-primary/5 ring-2 ring-primary/15", isDragReject && "border-destructive bg-destructive/5 ring-destructive/15") })}>
              <input {...getInputProps()} />
              <span className="mb-3 flex size-11 items-center justify-center rounded-xl border bg-card shadow-sm"><FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden="true" /></span>
              <p className="text-sm font-medium">{isDragActive ? "Отпустите файл здесь" : "Перетащите файл сюда"}</p>
              <p className="mt-1 text-sm text-muted-foreground">или нажмите, чтобы выбрать на устройстве</p>
              <p id={`${id}-formats`} className="mt-4 text-xs text-muted-foreground">CSV, XLSX или XLS · один файл до 4 МБ</p>
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); if (text.length > 100_000) { setError("Текст слишком длинный. Максимум — 100 000 символов."); return; } if (!text.trim()) { setError("Вставьте текст отчёта перед обработкой."); return; } processData({ source: "text", text: text.trim() }); }} className="space-y-3">
              <label htmlFor={`${id}-text`} className="block text-sm font-medium">Текст отчёта</label>
              <textarea disabled={disabled} id={`${id}-text`} value={text} onChange={(event) => { setText(event.target.value); setError(null); }} placeholder="Вставьте сырой отчёт, заметки или любой текст с данными…" className="min-h-36 w-full resize-y rounded-xl border bg-background/60 px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" />
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Форматировать текст не нужно</span><Button type="submit" disabled={disabled || !text.trim()} className="rounded-xl">Обработать текст</Button></div>
            </form>
          )}
          </StateTransition>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div key="error" role="alert" initial={{ opacity: 0, y: reduceMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><p className="flex-1">{error}</p><button type="button" onClick={() => setError(null)} aria-label="Закрыть ошибку" className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden="true" /></button>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-3 text-[11px] text-muted-foreground">После подготовки данные отправляются на сервер и выбранной модели через Netlify AI Gateway для анализа.</p>
      </MotionSurface>
    </section>
  );
}
