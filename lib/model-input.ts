import type { InsightInput } from "./insight-schema";

/** Lossless column-oriented envelope: headers once, every row in the same order. */
type ModelInput = InsightInput | { type: "tabular"; format: string; columns: string[]; rowCount: number; rows: (string | number | boolean | null)[][] };

export function modelInput(input: InsightInput): ModelInput {
  if (input.type === "text") return input;
  const columns = Array.from(new Set(input.data.flatMap(row => Object.keys(row))));
  // Do not turn a sparse table into a huge rectangular matrix.
  if (columns.length * input.data.length > 1_000_000) return { type: "tabular", columns, rowCount: input.data.length, data: input.data };
  return {
    type: "tabular",
    format: "rows: массивы значений в порядке columns; null означает отсутствие значения",
    columns,
    rowCount: input.data.length,
    rows: input.data.map(row => columns.map(column => Object.hasOwn(row, column) ? row[column] : null)),
  };
}
