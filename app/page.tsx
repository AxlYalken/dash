import { ThemeToggle } from "@/components/theme-toggle";
import { AudioLines, ChevronRight } from "lucide-react";
import { DataInput } from "@/components/dashboard/data-input";
import { ErrorBoundary } from "@/components/error-boundary";
import { Reveal } from "@/components/dashboard/reveal";

export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Перейти к содержимому</a>
      <header className="border-b bg-card/70">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><AudioLines className="size-5" aria-hidden="true" /></span><span className="text-lg font-semibold tracking-tight">нарратив<span className="text-muted-foreground">.</span></span><span className="ml-1 rounded border px-1.5 py-0.5 text-[9px] tracking-widest text-muted-foreground">БЕТА</span></div>
          <div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-muted-foreground/60" /> Личное пространство</span><ThemeToggle /></div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 pb-[calc(var(--chat-height,12rem)+3rem)] pt-8 sm:px-8 sm:pt-10">
        <div className="mb-8 flex items-center gap-2 text-xs text-muted-foreground"><span>Рабочее пространство</span><ChevronRight className="size-3" aria-hidden="true" /><span className="text-foreground">Обзор</span></div>
        <Reveal>
          <div className="mb-10"><p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Анализ данных с помощью ИИ</p><h1 className="text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">Визуализация данных.</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">Находите главное в отчётах и задавайте вопросы по своим данным.</p></div>
        </Reveal>
        <div className="section-stack"><ErrorBoundary name="дашборд"><DataInput /></ErrorBoundary></div>
        <p className="mt-6 text-xs text-muted-foreground">Начните с таблицы или отчёта — и найдите то, что важно.</p>
      </main>
    </>
  );
}
