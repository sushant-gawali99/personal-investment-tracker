import { classifyRow } from "./classify";
import { matchFd } from "./match";
import type { FdTxnType, MatchCandidate } from "./types";

export interface LinkableTxn {
  description: string;
  direction: "debit" | "credit";
}

export interface LinkResult {
  fdId: string;
  fdTxnType: FdTxnType;
  categoryId: string;
}

/**
 * Tries to link a single transaction to one of the user's FDs.
 *
 * Returns null when:
 *   - The description has no FD number, OR
 *   - The match is ambiguous (two FDs could plausibly own this row), OR
 *   - The classifier returns "other" (no semantic FD action detected — we
 *     refuse to link these because we wouldn't know which category to use), OR
 *   - The resolved `fdTxnType` has no category entry in `categories`.
 *
 * Note: "tds" descriptions don't contain an FD number by design, so matchFd
 * returns "none" — the function returns null without linking. That's OK:
 * TDS rows that *do* reference an FD (rare) will have FD number pulled by
 * classifyRow when the detector still finds it; when not, they stay generic.
 */
export function linkTransactionToFd(
  txn: LinkableTxn,
  fds: MatchCandidate[],
  categories: Map<FdTxnType, string>,
): LinkResult | null {
  const { type, detectedFdNumber } = classifyRow(txn.description);
  if (type === "other") return null;

  const match = matchFd(detectedFdNumber, fds);
  if (match.kind !== "matched") return null;

  const categoryId = categories.get(type);
  if (!categoryId) return null;

  return { fdId: match.fdId, fdTxnType: type, categoryId };
}
