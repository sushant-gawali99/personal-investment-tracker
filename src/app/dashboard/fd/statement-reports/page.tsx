import Link from "next/link";
import { Plus, FileText, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatDate } from "@/lib/format";

export default async function StatementReportsPage() {
  const userId = await getSessionUserId();
  const reports = await prisma.fDStatementReport.findMany({
    where: { userId: userId ?? "" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolderName: true,
      statementFromDate: true,
      statementToDate: true,
      createdAt: true,
      reportJson: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/dashboard/fd"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#606065] hover:text-[#a0a0a5] transition-colors mb-2"
          >
            <ArrowLeft size={12} />
            Fixed Deposits
          </Link>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Past FD Interest</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">
            Upload bank statements to generate FD interest reports for past deposits.
          </p>
        </div>
        <Link
          href="/dashboard/fd/statement-reports/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[rgba(255,56,92,0.15)] border border-[rgba(255,56,92,0.35)] text-[#ff385c] text-[13px] font-bold hover:bg-[rgba(255,56,92,0.22)] hover:border-[rgba(255,56,92,0.5)] transition-all w-full sm:w-auto"
        >
          <Plus size={14} />
          Upload FD Statement
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={40} className="text-[#3a3a3e] mb-4" />
          <p className="text-[15px] font-semibold text-[#ededed]">No reports yet</p>
          <p className="text-[13px] text-[#a0a0a5] mt-1 max-w-xs">
            Upload a bank passbook or savings account statement to extract FD interest history.
          </p>
          <Link
            href="/dashboard/fd/statement-reports/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(255,56,92,0.15)] border border-[rgba(255,56,92,0.35)] text-[#ff385c] text-[13px] font-bold hover:bg-[rgba(255,56,92,0.22)] transition-all"
          >
            <Plus size={14} />
            Upload FD Statement
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.map((r: typeof reports[number]) => {
            const data = JSON.parse(r.reportJson) as { fds: Array<{ closureType: string }> };
            const fdCount = data.fds.length;
            const maturedCount = data.fds.filter((f) => f.closureType === "matured").length;
            const prematureCount = data.fds.filter((f) => f.closureType === "premature").length;
            const ongoingCount = data.fds.filter((f) => f.closureType === "ongoing").length;

            return (
              <Link
                key={r.id}
                href={`/dashboard/fd/statement-reports/${r.id}`}
                className="block bg-[#0d0d0f] border border-[#2a2a2d] rounded-xl p-5 hover:border-[#3a3a3e] transition-all group overflow-hidden"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#ededed] truncate">{r.bankName}</p>
                    {r.accountHolderName && (
                      <p className="text-[13px] text-[#a0a0a5] mt-0.5">{r.accountHolderName}</p>
                    )}
                    {r.accountNumber && (
                      <p className="text-[12px] text-[#606065] mt-0.5">A/C {r.accountNumber}</p>
                    )}
                  </div>
                  <div className="sm:text-right sm:shrink-0">
                    <p className="text-[12px] text-[#606065]">Added {formatDate(r.createdAt)}</p>
                    {r.statementFromDate && r.statementToDate && (
                      <p className="text-[12px] text-[#606065] mt-0.5">
                        {formatDate(r.statementFromDate)} – {formatDate(r.statementToDate)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-[12px] text-[#a0a0a5]">{fdCount} FD{fdCount !== 1 ? "s" : ""}</span>
                  {maturedCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0f2a1a] border border-[#1a4a2e] text-[#4ade80]">
                      {maturedCount} matured
                    </span>
                  )}
                  {prematureCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2a1a0a] border border-[#4a2e0f] text-[#fb923c]">
                      {prematureCount} premature
                    </span>
                  )}
                  {ongoingCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1a1a2a] border border-[#2e2e4a] text-[#818cf8]">
                      {ongoingCount} ongoing
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
