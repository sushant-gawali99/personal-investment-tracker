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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Nav links — equal-width on mobile, natural-width on desktop */}
          <div className="flex gap-1 p-1 bg-[#1c1c20] rounded-xl sm:rounded-full sm:inline-flex">
            {[
              { href: "/dashboard/bank-accounts/list", label: "Transactions" },
              { href: "/dashboard/bank-accounts/accounts", label: "Accounts" },
              { href: "/dashboard/bank-accounts/categories", label: "Categories" },
              { href: "/dashboard/bank-accounts/imports", label: "Imports" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex-1 sm:flex-none text-center px-2 sm:px-4 py-1.5 rounded-lg sm:rounded-full text-[12px] sm:text-[13px] font-semibold text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#17171a] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
          <Link href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent justify-center">
            <Upload size={15} /> Import Statement
          </Link>
        </div>
      </div>
      <OverviewClient accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} />
    </div>
  );
}
