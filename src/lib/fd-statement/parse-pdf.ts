import type { ParsedTxn } from "./types";
import { parseStatementText } from "./regex-parser";
import { parseWithAI } from "./ai-parser";

export interface ParseOutput {
  txns: ParsedTxn[];
  parseMethod: "regex" | "ai";
}

async function extractText(pdfBytes: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.warn("[fd-statement] pdf-parse unavailable, falling back to AI:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function parseStatementPdf(pdfBytes: Buffer): Promise<ParseOutput> {
  const text = await extractText(pdfBytes);
  if (text !== null) {
    const regexTxns = parseStatementText(text);
    if (regexTxns.length > 0) return { txns: regexTxns, parseMethod: "regex" };
  }
  const aiTxns = await parseWithAI(pdfBytes);
  return { txns: aiTxns, parseMethod: "ai" };
}
