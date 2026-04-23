// src/app/dashboard/bank-accounts/categories/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { CategoriesClient } from "./categories-client";
import { BackLink } from "@/components/bank-accounts/back-link";

export default async function CategoriesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [categories, rules] = await Promise.all([
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.merchantRule.findMany({
      // Include system-wide rules (userId=null) alongside the user's own.
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { matchCount: "desc" },
      include: { category: true },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink />
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Categories & Rules</h1>
        <p className="text-[14px] text-[#a0a0a5]">Preset + custom categories and your learned merchant rules.</p>
      </div>
      <CategoriesClient categories={categories.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))} rules={rules.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), category: { ...r.category, createdAt: r.category.createdAt.toISOString(), updatedAt: r.category.updatedAt.toISOString() } }))} />
    </div>
  );
}
