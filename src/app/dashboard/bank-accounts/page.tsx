// src/app/dashboard/bank-accounts/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { OverviewClient } from "./overview-client";

export default async function BankAccountsOverview() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const accounts = await prisma.bankAccount.findMany({
    where: { userId, disabled: false }, orderBy: { label: "asc" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Bank Accounts</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Import statements and analyse spending.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/bank-accounts/list" className="ab-btn ab-btn-ghost">Transactions</Link>
          <Link href="/dashboard/bank-accounts/accounts" className="ab-btn ab-btn-ghost">Accounts</Link>
          <Link href="/dashboard/bank-accounts/categories" className="ab-btn ab-btn-ghost">Categories</Link>
          <Link href="/dashboard/bank-accounts/imports" className="ab-btn ab-btn-ghost">Imports</Link>
          <Link href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent">
            <Upload size={15} /> Import Statement
          </Link>
        </div>
      </div>
      <OverviewClient accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} />
    </div>
  );
}
