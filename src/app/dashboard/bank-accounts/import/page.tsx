import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
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
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Import Statement</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Upload a PDF, review extracted rows, commit.</p>
      </div>
      <ImportWizard accounts={accounts} categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))} />
    </div>
  );
}
