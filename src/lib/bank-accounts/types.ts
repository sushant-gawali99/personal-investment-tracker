export type Direction = "debit" | "credit";
export type CategoryKind = "expense" | "income" | "transfer";
export type CategorySource = "claude" | "rule" | "user" | "transfer-detect";
export type ImportStatus =
  | "pending" | "extracting" | "preview" | "saved" | "failed" | "cancelled";

export interface ExtractedTxn {
  txnDate: string;          // YYYY-MM-DD (local)
  valueDate: string | null;
  description: string;
  amount: number;
  direction: Direction;
  runningBalance: number | null;
  bankRef: string | null;
  claudeCategory: string | null; // Claude's suggested category name (validated later)
}

export interface StagedTxn extends ExtractedTxn {
  normalizedDescription: string;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
  skip: boolean;            // user may drop a row in preview
}

export interface CategoryLite {
  id: string;
  name: string;
  kind: CategoryKind;
  userId: string | null;    // null = preset
}

export interface MerchantRuleLite {
  id: string;
  pattern: string;
  categoryId: string;
}
