export type FdTxnType =
  | "interest"
  | "maturity"
  | "premature_close"
  | "transfer_in"
  | "transfer_out"
  | "tds"
  | "other";

export interface MatchCandidate {
  fdId: string;
  fdNumber: string | null;
  accountNumber: string | null;
}

export type MatchResult =
  | { kind: "matched"; fdId: string }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "none" };
