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

  // Latest *saved* import with a non-null closing balance, per account.
  // We rank by statementPeriodEnd desc (fall back to createdAt) so the
  // most recent statement drives the "current balance" display.
  const latestImports = await prisma.statementImport.findMany({
    where: { userId, status: "saved", closingBalance: { not: null } },
    orderBy: [{ statementPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { accountId: true, closingBalance: true, statementPeriodEnd: true, createdAt: true },
  });
  const latestClosingByAccount = new Map<string, { closingBalance: number; asOf: string }>();
  for (const imp of latestImports) {
    if (latestClosingByAccount.has(imp.accountId)) continue;
    latestClosingByAccount.set(imp.accountId, {
      closingBalance: imp.closingBalance!,
      asOf: (imp.statementPeriodEnd ?? imp.createdAt).toISOString(),
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
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Bank Accounts</h1>
        <p className="text-[14px] text-[#a0a0a5]">Manage accounts linked to imported statements.</p>
      </div>
      <AccountsClient accounts={enriched} />
    </div>
  );
}
