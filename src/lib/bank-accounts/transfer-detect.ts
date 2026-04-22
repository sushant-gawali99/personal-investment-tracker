import { amountToPaise } from "./dedup";

interface TxnLite {
  id: string;
  accountId: string;
  txnDate: string;
  amount: number;
  direction: "debit" | "credit";
  transferGroupId: string | null;
  categorySource: string | null;
  description: string;
}

export interface TransferPair {
  debitId: string;
  creditId: string;
  groupId: string;
}

function daysBetween(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Math.abs(ta - tb) / 86400000;
}

function randomGroupId(): string {
  return "tr_" + Math.random().toString(36).slice(2, 10);
}

export function findTransferPairs(txns: TxnLite[]): TransferPair[] {
  const eligible = txns.filter((t) => !t.transferGroupId && t.categorySource !== "user");
  const debits = eligible.filter((t) => t.direction === "debit");
  const credits = eligible.filter((t) => t.direction === "credit");

  const used = new Set<string>();
  const pairs: TransferPair[] = [];

  const sortedDebits = [...debits].sort((a, b) => a.txnDate.localeCompare(b.txnDate));
  for (const d of sortedDebits) {
    if (used.has(d.id)) continue;
    const dPaise = amountToPaise(d.amount);
    const candidates = credits.filter((c) =>
      !used.has(c.id) &&
      c.accountId !== d.accountId &&
      amountToPaise(c.amount) === dPaise &&
      daysBetween(c.txnDate, d.txnDate) <= 1,
    );
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const da = daysBetween(a.txnDate, d.txnDate);
      const db = daysBetween(b.txnDate, d.txnDate);
      if (da !== db) return da - db;
      const aHit = d.description.toUpperCase().includes(a.accountId.toUpperCase()) ? -1 : 0;
      const bHit = d.description.toUpperCase().includes(b.accountId.toUpperCase()) ? -1 : 0;
      return aHit - bHit;
    });

    const match = candidates[0];
    used.add(d.id);
    used.add(match.id);
    pairs.push({ debitId: d.id, creditId: match.id, groupId: randomGroupId() });
  }

  return pairs;
}
