import { anthropic } from "@/lib/anthropic";
import type { ExtractedTxn } from "./types";
import { buildSystemPrompt, buildUserText } from "./extract-transactions-prompt";
import { estimateCostUsd } from "./cost-tracking";
import { extractPdfText, TEXT_VISION_FALLBACK_THRESHOLD } from "./pdf-text";
import { parseStatementText } from "./js-parser";

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

/**
 * Parse Claude's response as JSON, tolerating prose prefixes/suffixes and
 * code fences. If the raw response can't be parsed, find the outermost
 * `{ ... }` block and retry. Throws with a preview of the response on failure.
 */
function parseJsonResponse(raw: string): unknown {
  const stripped = stripFences(raw);
  try {
    return JSON.parse(stripped);
  } catch {
    // Claude may have wrapped JSON with prose or left an unclosed trailing
    // object (e.g. truncated at max_tokens). Try to extract the outermost {...}.
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(stripped.slice(first, last + 1));
      } catch {
        /* fall through */
      }
    }
    const preview = raw.length > 500 ? raw.slice(0, 500) + "…" : raw;
    throw new Error(`Claude returned malformed JSON. First 500 chars: ${preview}`);
  }
}

export async function extractTransactions(
  pdfBytes: Buffer,
  categoryNames: string[],
): Promise<ExtractionResult> {
  // Try text-first: much faster (~5-15s vs 30-60s for vision) and cheaper.
  // Fall back to vision mode only if the PDF has no extractable text (scanned).
  let extractedText: string | null = null;
  const tPdf = Date.now();
  try {
    const result = await extractPdfText(pdfBytes);
    if (result.text.trim().length > TEXT_VISION_FALLBACK_THRESHOLD) {
      extractedText = result.text;
    }
    console.log(
      `[extract] pdf-parse ${Date.now() - tPdf}ms, textLen=${result.text.length}, pages=${result.pageCount}, mode=${extractedText ? "text" : "vision-fallback"}`,
    );
  } catch (e) {
    console.log(`[extract] pdf-parse FAILED after ${Date.now() - tPdf}ms:`, e instanceof Error ? e.message : e);
    // pdf-parse failed (e.g. encrypted PDF); fall through to vision
  }

  // JS-first: try deterministic regex parsers for known bank formats. If
  // confident, skip Claude entirely (instant, free, no API dependency).
  if (extractedText) {
    const jsParsed = parseStatementText(extractedText);
    if (jsParsed.confident) {
      console.log(
        `[extract] js-parser hit: ${jsParsed.transactions.length} txns, ${jsParsed.unparsedBlocks.length} unparsed blocks`,
      );
      return {
        statementPeriodStart: jsParsed.statementPeriodStart,
        statementPeriodEnd: jsParsed.statementPeriodEnd,
        transactions: jsParsed.transactions,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
    }
    console.log("[extract] js-parser unknown format, falling back to Claude");
  }

  const systemPrompt = buildSystemPrompt({ categoryNames, extractedText });

  const userContent: unknown[] = [];
  if (!extractedText) {
    const pdfBlock: DocumentBlockParam = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBytes.toString("base64") },
    };
    userContent.push(pdfBlock);
  }
  userContent.push({ type: "text", text: buildUserText(extractedText) });

  // Use streaming: the SDK requires it when max_tokens is large enough that
  // generation could theoretically exceed 10 minutes. We still collect the
  // whole response before returning — the streaming is purely transport.
  const tClaude = Date.now();
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    // Haiku 4.5 supports up to 64k output tokens. Each transaction serialises
    // to ~150 tokens of JSON, so 16k was only good for ~90 txns — a busy
    // month of UPI activity easily exceeds that.
    max_tokens: 64000,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as never,
    ] as never,
    messages: [
      { role: "user", content: userContent as never },
    ],
  });
  const res = await stream.finalMessage();
  console.log(`[extract] claude stream completed in ${Date.now() - tClaude}ms`);

  console.log(
    `[extract] claude ${res.usage.input_tokens}→${res.usage.output_tokens} tok, stop=${res.stop_reason}`,
  );

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { statementPeriodStart: null, statementPeriodEnd: null, transactions: [], inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costUsd: estimateCostUsd(res.usage.input_tokens, res.usage.output_tokens) };
  }

  // If Claude was truncated by max_tokens, the JSON will be malformed. Surface that clearly.
  if (res.stop_reason === "max_tokens") {
    throw new Error(
      `Claude response was truncated at max_tokens (${res.usage.output_tokens} out). The statement may have too many transactions for a single pass.`,
    );
  }

  const parsed = parseJsonResponse(textBlock.text) as RawResponse;

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
