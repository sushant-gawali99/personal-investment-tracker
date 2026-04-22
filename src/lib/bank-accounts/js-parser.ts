import type { ExtractedTxn } from "./types";

export interface JsParseResult {
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  transactions: ExtractedTxn[];
  /** True when we recognised the bank and confidently parsed >= 1 transaction. */
  confident: boolean;
  /** Text blocks the parser could not match — useful for debugging + Claude fallback. */
  unparsedBlocks: string[];
}

/**
 * Try every known bank parser. Returns the first confident result, or the
 * last result with confident=false (empty) if no parser recognised the text.
 */
export function parseStatementText(text: string): JsParseResult {
  const parsers = [parseAxis];
  for (const p of parsers) {
    const r = p(text);
    if (r.confident) return r;
  }
  return { statementPeriodStart: null, statementPeriodEnd: null, transactions: [], confident: false, unparsedBlocks: [] };
}

// ────────────────────────────────────────────────────────────────────────────
// Axis Bank — format observed in "Statement of Axis Account No : ..."
// ────────────────────────────────────────────────────────────────────────────

function isAxisStatement(text: string): boolean {
  return /Statement of Axis Account No/i.test(text);
}

/** DD-MM-YYYY → YYYY-MM-DD */
function isoDate(dmy: string): string {
  const [dd, mm, yyyy] = dmy.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

function parseNumber(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

/**
 * Strip page footers and page-break noise that pdf-parse interleaves with
 * transaction rows (e.g. "-- 2 of 6 --", branch address headers that only
 * appear mid-statement between pages).
 */
function stripPageNoise(s: string): string {
  return s
    .replace(/--\s*\d+\s*of\s*\d+\s*--/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Axis rows in the extracted text look like:
 *
 *     DD-MM-YYYY <description possibly spanning lines> AMOUNT BALANCE BRANCH
 *
 * Page breaks sometimes concatenate the last txn of a page with the first
 * txn of the next page. We handle this by iteratively consuming one
 * transaction at a time with a regex that stops at the first amount/balance/branch
 * triad rather than anchoring on ^ / $.
 */
const AXIS_ROW_RX =
  /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(\d{3,6})(?=\s|$)/;

export function parseAxis(text: string): JsParseResult {
  if (!isAxisStatement(text)) {
    return { statementPeriodStart: null, statementPeriodEnd: null, transactions: [], confident: false, unparsedBlocks: [] };
  }

  const period = text.match(/From\s*:\s*(\d{2}-\d{2}-\d{4})\s*To\s*:\s*(\d{2}-\d{2}-\d{4})/);
  const statementPeriodStart = period ? isoDate(period[1]) : null;
  const statementPeriodEnd = period ? isoDate(period[2]) : null;

  const opening = text.match(/OPENING BALANCE\s+([\d,]+\.\d{2})/);
  if (!opening) {
    return { statementPeriodStart, statementPeriodEnd, transactions: [], confident: false, unparsedBlocks: [] };
  }
  let runningBalance = parseNumber(opening[1]);

  // Group lines into candidate blocks (each starting with a date), stopping
  // at the closing balance / end-of-statement markers.
  const lines = text.split(/\r?\n/);
  const rawBlocks: string[] = [];
  let cur: string[] | null = null;
  for (const ln of lines) {
    if (/^\d{2}-\d{2}-\d{4}\s/.test(ln)) {
      if (cur) rawBlocks.push(cur.join(" "));
      cur = [ln];
    } else if (cur) {
      if (/^CLOSING BALANCE|^TRANSACTION TOTAL|^\+\+\+\+ End of Statement/i.test(ln.trim())) {
        rawBlocks.push(cur.join(" "));
        cur = null;
        break;
      }
      if (ln.trim()) cur.push(ln);
    }
  }
  if (cur) rawBlocks.push(cur.join(" "));

  const transactions: ExtractedTxn[] = [];
  const unparsedBlocks: string[] = [];

  // Each raw block may contain 1+ transactions (page-break concatenation).
  // Iteratively consume one match at a time.
  for (const raw of rawBlocks) {
    let remaining = stripPageNoise(raw);
    let safety = 10;
    while (remaining.length > 0 && safety-- > 0) {
      const m = remaining.match(AXIS_ROW_RX);
      if (!m || m.index === undefined) {
        if (remaining.trim()) unparsedBlocks.push(remaining);
        break;
      }

      // Anything before the match is junk — record it.
      if (m.index > 0) {
        const pre = remaining.slice(0, m.index).trim();
        if (pre) unparsedBlocks.push(pre);
      }

      const [, dateStr, descRaw, amountStr, balanceStr] = m;
      const amount = parseNumber(amountStr);
      const balance = parseNumber(balanceStr);

      // Direction from balance delta. If the delta doesn't match the amount
      // (within rounding), the row is suspicious — record as unparsed.
      const delta = balance - runningBalance;
      const direction: "debit" | "credit" = delta < 0 ? "debit" : "credit";
      if (Math.abs(Math.abs(delta) - amount) > 0.5) {
        unparsedBlocks.push(remaining.slice(0, m.index + m[0].length));
        remaining = remaining.slice(m.index + m[0].length).trim();
        continue;
      }
      runningBalance = balance;

      const description = descRaw.trim().replace(/\s+/g, " ");
      // UPI ref: first run of 10+ digits between slashes.
      const refMatch = description.match(/\/(\d{10,})\//);

      transactions.push({
        txnDate: isoDate(dateStr),
        valueDate: null,
        description,
        amount,
        direction,
        runningBalance: balance,
        bankRef: refMatch ? refMatch[1] : null,
        claudeCategory: null,
      });

      remaining = remaining.slice(m.index + m[0].length).trim();
    }
  }

  return {
    statementPeriodStart,
    statementPeriodEnd,
    transactions,
    confident: transactions.length > 0,
    unparsedBlocks,
  };
}
