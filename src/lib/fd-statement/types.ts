export type TxnType =
  | "interest"
  | "maturity"
  | "premature_close"
  | "transfer_in"
  | "transfer_out"
  | "tds"
  | "other";

export interface ParsedTxn {
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
}

export interface MatchCandidate {
  fdId: string;
  fdNumber: string | null;
  accountNumber: string | null;
  label: string;
  maturityDate: string;
}

export type MatchResult =
  | { kind: "matched"; fdId: string }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "none" };
