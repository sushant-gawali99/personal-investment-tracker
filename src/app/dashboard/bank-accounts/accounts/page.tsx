// src/app/dashboard/bank-accounts/accounts/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccountsClient } from "./accounts-client";
import { BackLink } from "@/components/bank-accounts/back-link";

export default async function AccountsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const accounts = await prisma.bankAccount.findMany({
    where: { userId },
    orderBy: { label: "asc" },
  });
  const counts = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: { userId },
    _count: { _all: true },
    _max: { txnDate: true },
  });
  const byId = new Map(counts.map((c) => [c.accountId, c]));

  // Current balance per account = the running balance of the most recent
  // transaction, ordered by (txnDate, statementSeq, createdAt). Sourcing it
  // from transactions (not StatementImport.closingBalance) correctly handles
  // overlapping imports — e.g. a wide statement covering Apr–May alongside a
  // single-day statement for the latest day: the one-day import has the truly
  // latest activity, so its last transaction's runningBalance wins.
  const latestTxnPerAccount = await prisma.$queryRaw<
    Array<{ accountId: string; runningBalance: number | null; txnDate: Date }>
  >`
    SELECT t1.accountId, t1.runningBalance, t1.txnDate
    FROM "Transaction" t1
    WHERE t1.userId = ${userId}
      AND t1.runningBalance IS NOT NULL
      AND t1.id = (
        SELECT t2.id FROM "Transaction" t2
        WHERE t2.accountId = t1.accountId AND t2.userId = ${userId}
          AND t2.runningBalance IS NOT NULL
        ORDER BY t2.txnDate DESC, t2.statementSeq DESC, t2.createdAt DESC
        LIMIT 1
      )
  `;
  const latestClosingByAccount = new Map<string, { closingBalance: number; asOf: string }>();
  for (const t of latestTxnPerAccount) {
    if (t.runningBalance == null) continue;
    latestClosingByAccount.set(t.accountId, {
      closingBalance: t.runningBalance,
      asOf: t.txnDate.toISOString(),
    });
  }

  const enriched = accounts.map((a) => ({
    ...a,
    txnCount: byId.get(a.id)?._count._all ?? 0,
    lastTxnDate: byId.get(a.id)?._max.txnDate?.toISOString() ?? null,
    closingBalance: latestClosingByAccount.get(a.id)?.closingBalance ?? null,
    balanceAsOf: latestClosingByAccount.get(a.id)?.asOf ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink />
        <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">Bank Accounts</h1>
        <p className="text-[14px] text-[var(--text-secondary)]">Manage accounts linked to imported statements.</p>
      </div>
      <AccountsClient accounts={enriched} />
    </div>
  );
}
