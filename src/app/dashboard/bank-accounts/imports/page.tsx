// src/app/dashboard/bank-accounts/imports/page.tsx
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { ImportsList } from "./imports-list";
import { BackLink } from "@/components/bank-accounts/back-link";

export default async function ImportsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [imports, ruleCovered, total] = await Promise.all([
    prisma.statementImport.findMany({
      where: { userId }, orderBy: { createdAt: "desc" },
      include: { account: true },
    }),
    prisma.transaction.count({ where: { userId, categorySource: "rule" } }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  const coverage = total === 0 ? 0 : Math.round((ruleCovered / total) * 100);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <BackLink />
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Imports</h1>
          <p className="text-[14px] text-[#a0a0a5]">
            {total > 0
              ? <>{coverage}% of {total} transactions auto-categorized by merchant rules</>
              : "No transactions imported yet"}
          </p>
        </div>
        <Link href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent shrink-0">
          <UploadCloud size={15} /> Import new statement
        </Link>
      </div>
      <ImportsList items={imports.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        statementPeriodStart: i.statementPeriodStart?.toISOString() ?? null,
        statementPeriodEnd: i.statementPeriodEnd?.toISOString() ?? null,
        account: { id: i.account.id, label: i.account.label },
      }))} />
    </div>
  );
}
