import type { TxnType } from "./types";

const FD_NUM_RE = /FD[-\s]?(?:NO\s+)?(\d{3,})/i;

export function classifyRow(particulars: string): { type: TxnType; detectedFdNumber: string | null } {
  const p = particulars.trim();
  const upper = p.toUpperCase();
  const fdMatch = p.match(FD_NUM_RE);
  const detectedFdNumber = fdMatch ? fdMatch[1] : null;

  if (/TDS/.test(upper)) return { type: "tds", detectedFdNumber: null };

  if (/PREMAT|PRECLOSE|PREMATURE/.test(upper) && detectedFdNumber) {
    return { type: "premature_close", detectedFdNumber };
  }
  if (/TR\s+TO\s+FD/.test(upper) && detectedFdNumber) {
    return { type: "transfer_out", detectedFdNumber };
  }
  if (/TRANSFER\s+FR\s+FD|TRANSFER\s+FROM\s+FD/.test(upper) && detectedFdNumber) {
    return { type: "transfer_in", detectedFdNumber };
  }
  if (/\bINT\b|INTEREST/.test(upper) && detectedFdNumber) {
    return { type: "interest", detectedFdNumber };
  }
  if (/\bMAT\b/.test(upper) && /CLSD|CLOSED/.test(upper) && detectedFdNumber) {
    return { type: "maturity", detectedFdNumber };
  }
  return { type: "other", detectedFdNumber };
}
