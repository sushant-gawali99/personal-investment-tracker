// src/app/dashboard/bank-accounts/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { OverviewClient } from "./overview-client";
import { BankBalanceStrip } from "@/components/bank-accounts/bank-balance-strip";

export default async function BankAccountsOverview() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const accounts = await prisma.bankAccount.findMany({
    where: { userId, disabled: false }, orderBy: { label: "asc" },
  });

  // Current balance per account = the running balance of the most recent
  // transaction. Sourcing it from transactions (not StatementImport.closingBalance)
  // correctly handles overlapping imports — e.g. a wide statement covering
  // Apr–May alongside a single-day statement for May 17: the one-day import has
  // the truly latest activity, so its last transaction's runningBalance wins.
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
  const latestByAccount = new Map<string, { closingBalance: number; asOf: string }>();
  for (const t of latestTxnPerAccount) {
    if (t.runningBalance == null) continue;
    latestByAccount.set(t.accountId, {
      closingBalance: t.runningBalance,
      asOf: t.txnDate.toISOString(),
    });
  }
  const balances = accounts.map((a) => ({
    id: a.id,
    label: a.label,
    bankName: a.bankName,
    closingBalance: latestByAccount.get(a.id)?.closingBalance ?? null,
    asOf: latestByAccount.get(a.id)?.asOf ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">Bank Accounts</h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">Import statements and analyse spending.</p>
          </div>
          <Link
            href="/dashboard/bank-accounts/import"
            className="ab-btn ab-btn-secondary shrink-0 gap-2"
          >
            <Upload size={14} className="text-[var(--primary)]" /> Import Statement
          </Link>
        </div>
        <BankBalanceStrip balances={balances} />
      </div>
      <OverviewClient
        accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
        balances={balances}
      />
    </div>
  );
}
