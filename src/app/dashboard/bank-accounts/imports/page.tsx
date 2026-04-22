// src/app/dashboard/bank-accounts/imports/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { ImportsList } from "./imports-list";

export default async function ImportsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [imports, totals, ruleCovered, total] = await Promise.all([
    prisma.statementImport.findMany({
      where: { userId }, orderBy: { createdAt: "desc" },
      include: { account: true },
    }),
    prisma.statementImport.aggregate({
      where: { userId }, _sum: { claudeCostUsd: true },
    }),
    prisma.transaction.count({ where: { userId, categorySource: "rule" } }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  const recentCost = imports.slice(0, 10).reduce((s, i) => s + (i.claudeCostUsd ?? 0), 0);
  const coverage = total === 0 ? 0 : Math.round((ruleCovered / total) * 100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Imports</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Total API cost: ${totals._sum.claudeCostUsd?.toFixed(2) ?? "0.00"} ·
          Last 10 imports: ${recentCost.toFixed(2)} ·
          Rules cover {coverage}% of transactions
        </p>
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
