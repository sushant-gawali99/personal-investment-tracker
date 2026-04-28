export type FDTxnType =
  | "interest_payout"
  | "maturity_principal"
  | "maturity_interest"
  | "premature_principal"
  | "premature_interest"
  | "other";

export type FDTransaction = {
  date: string;
  description: string;
  amount: number;
  type: FDTxnType;
};

export type FDEntry = {
  fdNumber: string;
  transactions: FDTransaction[];
  totalInterest: number;
  principalReturned: number | null;
  closureType: "matured" | "premature" | "ongoing";
  closureDate: string | null;
  linkedFdId?: string | null;
  linkedFdLabel?: string | null;
};

export type FDReportData = {
  bankName: string;
  accountNumber: string | null;
  accountHolderName: string | null;
  statementFromDate: string | null;
  statementToDate: string | null;
  fds: FDEntry[];
};
