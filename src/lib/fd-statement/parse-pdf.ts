import type { ParsedTxn } from "./types";
import { parseStatementText } from "./regex-parser";
import { parseWithAI } from "./ai-parser";

export interface ParseOutput {
  txns: ParsedTxn[];
  parseMethod: "regex" | "ai";
}

export async function parseStatementPdf(pdfBytes: Buffer): Promise<ParseOutput> {
  // pdf-parse v2 is ESM and class-based; dynamic import avoids Next bundler issues.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
  let text = "";
  try {
    const result = await parser.getText();
    text = result.text ?? "";
  } finally {
    await parser.destroy();
  }
  const regexTxns = parseStatementText(text);
  if (regexTxns.length > 0) return { txns: regexTxns, parseMethod: "regex" };
  const aiTxns = await parseWithAI(pdfBytes);
  return { txns: aiTxns, parseMethod: "ai" };
}
