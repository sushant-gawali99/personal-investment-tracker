// src/app/dashboard/bank-accounts/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { ArrowLeftRight, Landmark, Tag, Files, Upload } from "lucide-react";
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
          <Link href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent shrink-0">
            <Upload size={15} /> Import Statement
          </Link>
        </div>
        <BankBalanceStrip balances={balances} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: "/dashboard/bank-accounts/list", label: "Transactions", icon: <ArrowLeftRight size={20} />, desc: "View & filter" },
            { href: "/dashboard/bank-accounts/accounts", label: "Bank Accounts", icon: <Landmark size={20} />, desc: "Manage accounts" },
            { href: "/dashboard/bank-accounts/categories", label: "Categories", icon: <Tag size={20} />, desc: "Rules & labels" },
            { href: "/dashboard/bank-accounts/imports", label: "Manage Statements", icon: <Files size={20} />, desc: "Imports history" },
          ].map(({ href, label, icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 p-3 sm:p-4 bg-[#1c1c20] border border-[#2a2a2e] rounded-xl hover:border-[#3a3a3e] hover:bg-[#222226] transition-all"
            >
              <span className="shrink-0 w-9 h-9 rounded-lg bg-[#2a2a2e] flex items-center justify-center text-[#ff385c] group-hover:bg-[#ff385c]/10 transition-colors">
                {icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#ededed] leading-tight truncate">{label}</span>
                <span className="block text-[11px] text-[#6e6e73] mt-0.5">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <OverviewClient
        accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
        balances={balances}
      />
    </div>
  );
}
