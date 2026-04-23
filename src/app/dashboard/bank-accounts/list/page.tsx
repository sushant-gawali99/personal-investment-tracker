import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { TransactionsTable } from "./transactions-table";
import { BackLink } from "@/components/bank-accounts/back-link";

export default async function ListPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [accounts, categories] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId, disabled: false }, orderBy: { label: "asc" } }),
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink />
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Transactions</h1>
        <p className="text-[14px] text-[#a0a0a5]">All imported transactions across your accounts.</p>
      </div>
      <TransactionsTable
        accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
