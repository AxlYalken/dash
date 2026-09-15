"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ChevronDown, MessageCircle, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { InsightInput } from "@/lib/insight-schema";
import { cn } from "@/lib/utils";

export interface ChatWithDataProps {
  data: InsightInput | null;
  suggestedQuestions?: string[];
}
async function chatFetch(input: RequestInfo | URL, init?: RequestInit) {
  let response: Response;
  try { response = await fetch(input, init); } catch (error) { if (init?.signal?.aborted) throw error; throw new Error("Не удалось связаться с сервером. Проверьте соединение и повторите вопрос."); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((typeof body?.error === "string" ? body.error : undefined) || "Не удалось отправить вопрос. Попробуйте ещё раз.");
  }
  return response;
}

export function ChatWithData({ data, suggestedQuestions = [] }: ChatWithDataProps) {
  const [mounted, setMounted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(true);
  const reduced = useReducedMotion();
  const shell = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const submitting = useRef(false);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { data }, fetch: chatFetch }), [data]);
  const { messages, sendMessage, status, error, stop, regenerate, setMessages, clearError } = useChat({ transport, onFinish: ({ message, isAbort, isError }) => {
    if (!isAbort && !isError && !message.parts.some(part => part.type === "text" && part.text.trim())) setLocalError("Модель вернула пустой ответ. Повторите вопрос.");
  } });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { setMounted(true); return () => { void stop(); }; }, [stop]);
  useEffect(() => {
    const element = shell.current;
    if (!mounted || !element) return;
    const update = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const bottom = viewport ? Math.max(0, window.innerHeight - height - viewport.offsetTop) : 0;
      element.style.bottom = `${bottom}px`;
      element.style.setProperty("--chat-viewport", `${height}px`);
      document.documentElement.style.setProperty("--chat-height", `${element.getBoundingClientRect().height}px`);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--chat-height");
    };
  }, [mounted]);
  useEffect(() => {
    if (list.current && followBottom.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages, status, expanded]);
  useEffect(() => { if (!busy) submitting.current = false; }, [busy]);

  async function ask(question: string) {
    const value = question.trim();
    if (!data || !value || value.length > 2000 || busy || submitting.current) return;
    if (messages.length >= 40) { setLocalError("Достигнут лимит переписки. Нажмите «Новый чат», чтобы продолжить работу с отчётом."); return; }
    setLocalError(null);
    submitting.current = true; followBottom.current = true; setExpanded(true); setText("");
    try { await sendMessage({ text: value }); } catch { setLocalError("Не удалось отправить вопрос. Попробуйте ещё раз."); setText(value); } finally { submitting.current = false; }
  }
  const chips = Array.from(new Set(suggestedQuestions.map(value => value.trim()).filter(Boolean))).slice(0, 4);
  if (!mounted) return null;
  return createPortal(
    <section ref={shell} aria-labelledby="chat-title" lang="ru" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-5 sm:px-8">
      <div className="pointer-events-auto surface-card mx-auto flex max-h-[calc(var(--chat-viewport,100dvh)-2rem)] max-w-3xl flex-col overflow-hidden bg-card/95 shadow-chat backdrop-blur-xl">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          <MessageCircle className="size-4 text-muted-foreground" aria-hidden="true" /><h2 id="chat-title" className="text-xs font-medium">Вопросы по данным</h2>
          <span className="ml-auto text-[10px] text-muted-foreground">{data ? "По вашему отчёту" : "Сначала загрузите данные"}</span>
          {!!messages.length && <><button type="button" disabled={busy} onClick={() => { setMessages([]); clearError(); setLocalError(null); }} className="rounded px-2 py-1 text-[10px] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">Новый чат</button><button type="button" aria-label={expanded ? "Свернуть чат" : "Развернуть чат"} aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="rounded p-1 focus-visible:ring-2 focus-visible:ring-ring"><ChevronDown className={cn("size-4", !expanded && "rotate-180")} /></button></>}
        </div>
        {expanded && (messages.length > 0 || busy) && <div ref={list} role="log" aria-label="Переписка по отчёту" aria-live="off" onScroll={() => { const el = list.current; if (el) followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }} className="min-h-0 max-h-[38dvh] space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {messages.map(message => {
            const content = message.parts.filter(part => part.type === "text").map(part => part.text).join("");
            if (!content) return null;
            return <motion.div key={message.id} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .25 }} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("min-w-0 max-w-[88%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground")}><span className="sr-only">{message.role === "user" ? "Вы: " : "ИИ: "}</span>{content}</div></motion.div>;
          })}
          {busy && <div role="status" className="flex items-center gap-2 pl-1 text-[11px] text-muted-foreground"><span>печатает…</span><span aria-hidden="true" className="flex gap-1">{[0, 1, 2].map(i => <motion.span key={i} className="size-1 rounded-full bg-muted-foreground" animate={reduced ? {} : { opacity: [.25, 1, .25] }} transition={{ repeat: Infinity, duration: 1.1, delay: i * .16 }} />)}</span></div>}
        </div>}
        {(error || localError) && <div role="alert" className="flex max-h-24 shrink-0 items-center gap-3 overflow-y-auto border-t bg-destructive/5 px-4 py-3 text-xs"><p className="flex-1">{localError || (error ? "Не удалось получить ответ. Проверьте настройки модели и повторите вопрос." : "Ответ прервался. Попробуйте ещё раз.")}</p><button disabled={busy} onClick={() => { setLocalError(null); void regenerate().catch(() => setLocalError("Не удалось повторить ответ. Попробуйте ещё раз.")); }} className="shrink-0 underline">Повторить</button></div>}
        <form onSubmit={event => { event.preventDefault(); void ask(text); }} className="shrink-0 p-3">
          <div className="flex items-center gap-2"><Input value={text} onChange={event => setText(event.target.value)} maxLength={2000} disabled={!data} aria-label="Вопрос по данным" placeholder={data ? "Что вы хотите узнать из отчёта?" : "Загрузите таблицу или текст отчёта"} className="h-10 border-0 shadow-none focus-visible:ring-1" onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} />{busy ? <Button type="button" size="icon" variant="outline" onClick={() => { void stop(); }} aria-label="Остановить ответ" className="size-9 shrink-0 rounded-xl"><Square className="size-3" /></Button> : <Button type="submit" disabled={!data || !text.trim()} size="icon" aria-label="Отправить вопрос" className="size-9 shrink-0 rounded-xl"><ArrowUp className="size-4" /></Button>}</div>
          {chips.length > 0 && <div aria-label="Предложенные вопросы" className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{chips.map(question => <button key={question} type="button" disabled={!data || busy} onClick={() => { void ask(question); }} className="max-w-full break-words rounded-full border bg-background/60 px-3 py-1.5 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">{question}</button>)}</div>}
        </form>
      </div>
    </section>, document.body,
  );
}
