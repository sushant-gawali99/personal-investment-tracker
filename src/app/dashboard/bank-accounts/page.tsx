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

  // Compute the latest closing balance per account (from the most recent
  // saved import that reported one) so the overview can show a per-bank
  // current-balance strip.
  const latestImports = await prisma.statementImport.findMany({
    where: { userId, status: "saved", closingBalance: { not: null } },
    orderBy: [{ statementPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { accountId: true, closingBalance: true, statementPeriodEnd: true, createdAt: true },
  });
  const latestByAccount = new Map<string, { closingBalance: number; asOf: string }>();
  for (const imp of latestImports) {
    if (latestByAccount.has(imp.accountId)) continue;
    latestByAccount.set(imp.accountId, {
      closingBalance: imp.closingBalance!,
      asOf: (imp.statementPeriodEnd ?? imp.createdAt).toISOString(),
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
            <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Bank Accounts</h1>
            <p className="text-[14px] text-[#a0a0a5] mt-1">Import statements and analyse spending.</p>
          </div>
          <Link
            href="/dashboard/bank-accounts/import"
            className="ab-btn ab-btn-secondary shrink-0 gap-2"
          >
            <Upload size={14} className="text-[#ff385c]" /> Import Statement
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
