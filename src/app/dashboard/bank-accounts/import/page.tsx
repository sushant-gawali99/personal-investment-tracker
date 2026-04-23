import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Landmark, ArrowRight } from "lucide-react";
import { ImportWizard } from "./import-wizard";
import { BackLink } from "@/components/bank-accounts/back-link";

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

  // The wizard assumes at least one bank account exists — the dropdown
  // defaults to accounts[0] and the upload step has no way to pick "none".
  // Rather than render a broken wizard, nudge the user to add an account.
  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <BackLink href="/dashboard/bank-accounts/imports" label="Imports" />
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Import Statement</h1>
          <p className="text-[14px] text-[#a0a0a5]">Upload a PDF, review extracted rows, commit.</p>
        </div>
        <div className="ab-card flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(255,56,92,0.12)] border border-[rgba(255,56,92,0.25)]">
            <Landmark size={26} className="text-[#ff385c]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[18px] font-semibold text-[#ededed]">Add a bank account first</h2>
            <p className="text-[13px] text-[#a0a0a5] max-w-sm">
              Statements are imported into a specific account. Create at least one
              bank account, then come back here to upload a PDF.
            </p>
          </div>
          <Link
            href="/dashboard/bank-accounts/accounts"
            className="ab-btn ab-btn-primary inline-flex items-center gap-1.5"
          >
            Add bank account <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink href="/dashboard/bank-accounts/imports" label="Imports" />
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Import Statement</h1>
        <p className="text-[14px] text-[#a0a0a5]">Upload a PDF, review extracted rows, commit.</p>
      </div>
      <ImportWizard accounts={accounts} categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))} />
    </div>
  );
}
