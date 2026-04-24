import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    orderBy: { maturityDate: "asc" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });

  const fdIds = fds.map((f) => f.id);
  const allTxns =
    fdIds.length === 0
      ? []
      : await prisma.transaction.findMany({
          where: { fdId: { in: fdIds } },
          orderBy: { txnDate: "desc" },
          select: {
            id: true,
            fdId: true,
            txnDate: true,
            description: true,
            amount: true,
            direction: true,
            fdTxnType: true,
            account: { select: { label: true } },
          },
        });

  const txnsByFd = new Map<
    string,
    Array<{
      id: string;
      txnDate: string;
      particulars: string;
      debit: number;
      credit: number;
      type: string;
      accountLabel: string;
    }>
  >();
  for (const t of allTxns) {
    if (!t.fdId) continue;
    const isCredit = t.direction === "credit";
    const row = {
      id: t.id,
      txnDate: t.txnDate.toISOString(),
      particulars: t.description,
      debit: isCredit ? 0 : t.amount,
      credit: isCredit ? t.amount : 0,
      type: t.fdTxnType ?? "other",
      accountLabel: t.account.label,
    };
    const arr = txnsByFd.get(t.fdId) ?? [];
    arr.push(row);
    txnsByFd.set(t.fdId, arr);
  }

  const fdsWithTxns = fds.map((f) => ({ ...f, txns: txnsByFd.get(f.id) ?? [] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Fixed Deposits</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Track and analyse your fixed deposit investments.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Secondary — quiet dark pill with a "New" dot indicator */}
          <Link
            href="/dashboard/fd/bulk"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#a0a0a5] text-[13px] font-semibold hover:border-[#3a3a3e] hover:text-[#e0e0e4] transition-all flex-1 sm:flex-none justify-center"
          >
            <Upload size={13} />
            Bulk Upload
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff385c] shrink-0" title="New feature" />
          </Link>
          {/* Primary — clean solid accent */}
          <Link
            href="/dashboard/fd/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(255,56,92,0.15)] border border-[rgba(255,56,92,0.35)] text-[#ff385c] text-[13px] font-bold hover:bg-[rgba(255,56,92,0.22)] hover:border-[rgba(255,56,92,0.5)] transition-all flex-1 sm:flex-none justify-center"
          >
            <Plus size={14} />
            Add FD
          </Link>
        </div>
      </div>

      <FDList fds={fdsWithTxns} />
    </div>
  );
}
