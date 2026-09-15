export type CellValue = string | number | boolean | null;
export type TableRow = Record<string, CellValue>;
export type HeaderMode = "auto" | boolean;
export type ParseDataResponse =
  | { type: "tabular"; data: TableRow[]; columns: string[]; rowCount: number; error?: never }
  | { type: "text"; data: string; error?: never }
  | { type: "tabular"; data: []; error: string; code?: string }
  | { type: "text"; data: ""; error: string; code?: string };
