import { anthropic } from "@/lib/anthropic";
import type { ParsedTxn } from "./types";
import { classifyRow } from "./classify";

type DocumentBlockParam = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};

const PROMPT = `Extract every transaction row from this bank statement PDF. Return ONLY a JSON array (no prose). Each element:

{ "txnDate": "YYYY-MM-DD", "particulars": string, "debit": number, "credit": number }

Rules:
- txnDate: the transaction date, not the run/print date.
- particulars: the full "TRN-PARTICULARS" text as printed. Preserve FD numbers, account numbers, and keywords verbatim.
- debit / credit: numbers, 0 if blank. No commas.
- Include EVERY row, even "To RD...", "Interest Post", "TDS Deducted...".
- Do not include the opening balance line or totals.`;

type AiRow = { txnDate: string; particulars: string; debit: number; credit: number };

export async function parseWithAI(pdfBytes: Buffer): Promise<ParsedTxn[]> {
  const pdfBlock: DocumentBlockParam = {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: pdfBytes.toString("base64"),
    },
  };
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          pdfBlock as never,
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];
  const json = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  let rows: AiRow[];
  try {
    rows = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const { type, detectedFdNumber } = classifyRow(r.particulars);
    return {
      txnDate: r.txnDate,
      particulars: r.particulars,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      type,
      detectedFdNumber,
    };
  });
}
