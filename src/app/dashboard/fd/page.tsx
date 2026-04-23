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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link
            href="/dashboard/fd/bulk"
            className="ab-btn ab-btn-ghost relative flex-1 sm:flex-none justify-center"
            style={{ borderColor: "#ff385c", border: "1px solid #ff385c", color: "#ff385c" }}
          >
            <Upload size={15} />
            Bulk Upload
            <span
              className="ab-chip ab-chip-accent"
              style={{ fontSize: "10px", padding: "2px 6px", marginLeft: "4px" }}
            >
              New
            </span>
          </Link>
          <Link
            href="/dashboard/fd/new"
            className="ab-btn ab-btn-accent w-full sm:w-auto justify-center"
          >
            <Plus size={15} />
            Add FD
          </Link>
        </div>
      </div>

      <FDList fds={fdsWithTxns} />
    </div>
  );
}
