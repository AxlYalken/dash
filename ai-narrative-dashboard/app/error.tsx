"use client";

import { FeedbackState } from "@/components/dashboard/feedback-state";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-3xl p-6 py-16"><FeedbackState title="Не удалось открыть дашборд" message="Произошла ошибка страницы. Попробуйте загрузить её снова; возможно, потребуется повторно выбрать файл." onRetry={reset} action="Попробовать снова" /></main>;
}
