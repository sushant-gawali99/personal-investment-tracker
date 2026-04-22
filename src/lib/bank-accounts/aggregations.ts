export interface TxnForAgg {
  txnDate: string;
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string; kind: "expense" | "income" | "transfer" } | null;
  normalizedDescription: string;
}

const isTransfer = (t: TxnForAgg) => t.category?.kind === "transfer";

export function totalSpending(txns: TxnForAgg[]): number {
  return txns.filter((t) => t.direction === "debit" && !isTransfer(t)).reduce((s, t) => s + t.amount, 0);
}

export function totalIncome(txns: TxnForAgg[]): number {
  return txns.filter((t) => t.direction === "credit" && !isTransfer(t)).reduce((s, t) => s + t.amount, 0);
}

export function byCategory(txns: TxnForAgg[], direction: "debit" | "credit") {
  const buckets = new Map<string, { categoryId: string | null; name: string; total: number; count: number }>();
  for (const t of txns) {
    if (t.direction !== direction || isTransfer(t)) continue;
    const key = t.categoryId ?? "__uncat__";
    const name = t.category?.name ?? "Uncategorized";
    const row = buckets.get(key) ?? { categoryId: t.categoryId, name, total: 0, count: 0 };
    row.total += t.amount;
    row.count += 1;
    buckets.set(key, row);
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

export function byMonth(txns: TxnForAgg[]) {
  const map = new Map<string, { month: string; spending: number; income: number }>();
  for (const t of txns) {
    if (isTransfer(t)) continue;
    const month = t.txnDate.slice(0, 7);
    const row = map.get(month) ?? { month, spending: 0, income: 0 };
    if (t.direction === "debit") row.spending += t.amount;
    else row.income += t.amount;
    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function byDay(txns: TxnForAgg[], year: number, month: number): Record<string, number> {
  const mm = String(month).padStart(2, "0");
  const out: Record<string, number> = {};
  for (const t of txns) {
    if (t.direction !== "debit" || isTransfer(t)) continue;
    if (!t.txnDate.startsWith(`${year}-${mm}`)) continue;
    out[t.txnDate] = (out[t.txnDate] ?? 0) + t.amount;
  }
  return out;
}

export function topMerchants(txns: TxnForAgg[], limit: number) {
  const map = new Map<string, { normalizedDescription: string; total: number; count: number }>();
  for (const t of txns) {
    if (t.direction !== "debit" || isTransfer(t)) continue;
    const row = map.get(t.normalizedDescription) ?? { normalizedDescription: t.normalizedDescription, total: 0, count: 0 };
    row.total += t.amount;
    row.count += 1;
    map.set(t.normalizedDescription, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
