import { z } from "zod";

export const insightSchema = z.object({
  headline: z.string().trim().min(1).max(160).describe("Короткая суть главного инсайта на русском, не более 8 слов."),
  subtext: z.string().trim().min(1).max(1600).describe("Ровно 2–3 предложения на русском с подтверждёнными числами или фактами. При недостатке данных честно объясни ограничение."),
  suggestedQuestions: z.array(z.string().trim().min(1).max(160)).min(3).max(4).describe("3–4 различных коротких вопроса по конкретным данным отчёта, на русском. Не предполагай отсутствующих фактов."),
}).strict();
export type Insight = z.infer<typeof insightSchema>;

export function validInsight(insight: Insight): boolean {
  const sentences = Array.from(new Intl.Segmenter("ru", { granularity: "sentence" }).segment(insight.subtext.trim()));
  return Boolean(insight.headline.trim()) && insight.headline.trim().split(/\s+/u).length <= 8 && sentences.length >= 2 && sentences.length <= 3;
}

const cell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const insightInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), data: z.string().max(100_000) }).strict(),
  z.object({
    type: z.literal("tabular"),
    data: z.array(z.record(z.string(), cell)).max(50_000),
    columns: z.array(z.string()).max(500).optional(),
    rowCount: z.number().int().nonnegative().optional(),
  }).strict().refine(value => {
    const columns = new Set<string>();
    let cells = 0;
    for (const row of value.data) {
      const keys = Object.keys(row);
      cells += keys.length;
      if (cells > 1_000_000) return false;
      for (const key of keys) {
        if (key.length > 256) return false;
        columns.add(key);
        if (columns.size > 500) return false;
      }
    }
    return true;
  }, "Таблица превышает лимиты колонок или ячеек."),
]);
export type InsightInput = z.infer<typeof insightInputSchema>;
