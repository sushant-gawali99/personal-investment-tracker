export type VoucherType = "Payment" | "Receipt" | "Contra" | "Journal";

export interface LedgerConfig {
  bankLedgerName: string;
  categoryMappings: {
    categoryId: string | null; // null = uncategorized
    tallyLedgerName: string;
    voucherType: VoucherType;
  }[];
}

export interface TxnForExport {
  id: string;
  txnDate: Date;
  description: string;
  prettyDescription: string | null;
  amount: number;
  direction: string; // "debit" | "credit"
  categoryId: string | null;
}

export interface CategoryForExport {
  categoryId: string;
  categoryName: string;
  kind: string; // "expense" | "income" | "transfer"
}

export interface ExportFilters {
  from?: string;
  to?: string;
  accountId?: string;
  categoryIds?: string[];
  direction?: string;
  q?: string;
  minAmount?: string;
  maxAmount?: string;
}
