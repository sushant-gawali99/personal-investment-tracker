import { anthropic } from "@/lib/anthropic";
import type { ExtractedTxn } from "./types";
import { buildSystemPrompt, buildUserText } from "./extract-transactions-prompt";
import { estimateCostUsd } from "./cost-tracking";

type DocumentBlockParam = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};

export interface ExtractionResult {
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  transactions: ExtractedTxn[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface RawTxn {
  txnDate: string;
  valueDate: string | null;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  runningBalance: number | null;
  bankRef: string | null;
  suggestedCategory: string | null;
}

interface RawResponse {
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  transactions: RawTxn[];
}

function stripFences(s: string): string {
  return s.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

export async function extractTransactions(
  pdfBytes: Buffer,
  categoryNames: string[],
): Promise<ExtractionResult> {
  const systemPrompt = buildSystemPrompt({ categoryNames, extractedText: null });
  const pdfBlock: DocumentBlockParam = {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: pdfBytes.toString("base64") },
  };

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as never,
    ] as never,
    messages: [
      { role: "user", content: [pdfBlock as never, { type: "text", text: buildUserText() }] },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { statementPeriodStart: null, statementPeriodEnd: null, transactions: [], inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costUsd: estimateCostUsd(res.usage.input_tokens, res.usage.output_tokens) };
  }

  let parsed: RawResponse;
  try {
    parsed = JSON.parse(stripFences(textBlock.text));
  } catch {
    throw new Error("Claude returned malformed JSON");
  }

  const allowed = new Set(categoryNames);
  const transactions: ExtractedTxn[] = (parsed.transactions ?? []).map((r) => ({
    txnDate: r.txnDate,
    valueDate: r.valueDate,
    description: r.description,
    amount: Number(r.amount) || 0,
    direction: r.direction,
    runningBalance: r.runningBalance ?? null,
    bankRef: r.bankRef ?? null,
    claudeCategory: r.suggestedCategory && allowed.has(r.suggestedCategory) ? r.suggestedCategory : null,
  }));

  return {
    statementPeriodStart: parsed.statementPeriodStart ?? null,
    statementPeriodEnd: parsed.statementPeriodEnd ?? null,
    transactions,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: estimateCostUsd(res.usage.input_tokens, res.usage.output_tokens),
  };
}
