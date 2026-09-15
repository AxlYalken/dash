/** Raw input for the future analysis pipeline. No parsing or upload is performed. */
export type InputData =
  | { source: "file"; file: File }
  | { source: "text"; text: string };
