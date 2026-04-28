"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Printer, Trash2, Loader2, AlertTriangle, Link2 } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import type { FDReportData, FDEntry } from "@/lib/fd-statement-report/types";

const TXN_TYPE_LABELS: Record<string, string> = {
  interest_payout: "Interest",
  maturity_principal: "Maturity Principal",
  maturity_interest: "Maturity Interest",
  premature_principal: "Premature Closure",
  premature_interest: "Premature Interest",
  other: "Other",
};

const CLOSURE_COLORS: Record<string, string> = {
  matured: "text-[#4ade80] bg-[#0f2a1a] border-[#1a4a2e]",
  premature: "text-[#fb923c] bg-[#2a1a0a] border-[#4a2e0f]",
  ongoing: "text-[#818cf8] bg-[#1a1a2a] border-[#2e2e4a]",
};

function FDRow({ fd }: { fd: FDEntry }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = CLOSURE_COLORS[fd.closureType] ?? CLOSURE_COLORS.ongoing;

  return (
    <div className="border border-[#2a2a2d] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-2 px-4 py-3 bg-[#111114] hover:bg-[#161618] transition-colors text-left"
      >
        {expanded
          ? <ChevronDown size={14} className="text-[#606065] shrink-0 mt-0.5" />
          : <ChevronRight size={14} className="text-[#606065] shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#ededed] truncate">
              <span className="text-[#606065] font-normal">FD No.: </span>{fd.fdNumber}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${colorClass} shrink-0`}>
              {fd.closureType}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-[#4ade80] font-semibold">+{formatINR(fd.totalInterest)}</span>
            {fd.principalReturned != null && (
              <span className="text-[12px] text-[#a0a0a5]">P: {formatINR(fd.principalReturned)}</span>
            )}
            {fd.closureDate && (
              <span className="text-[11px] text-[#606065]">{formatDate(fd.closureDate)}</span>
            )}
            {fd.linkedFdId && (
              <Link
                href={`/dashboard/fd/${fd.linkedFdId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-[rgba(255,56,92,0.35)] text-[#ff385c] bg-[rgba(255,56,92,0.08)] hover:bg-[rgba(255,56,92,0.15)] transition-colors"
              >
                <Link2 size={10} />
                In system
              </Link>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2a2a2d]">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#0d0d0f]">
                  <th className="text-left px-3 py-2 text-[#606065] font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 text-[#606065] font-medium hidden sm:table-cell">Description</th>
                  <th className="text-left px-3 py-2 text-[#606065] font-medium">Type</th>
                  <th className="text-right px-3 py-2 text-[#606065] font-medium whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fd.transactions.map((t, i) => (
                  <tr key={i} className="border-t border-[#1e1e21]">
                    <td className="px-3 py-2 text-[#a0a0a5] whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2 text-[#c8c8cc] max-w-[180px] truncate hidden sm:table-cell">{t.description}</td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e21] text-[#a0a0a5] whitespace-nowrap">
                        {TXN_TYPE_LABELS[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[#ededed] font-medium whitespace-nowrap">
                      {formatINR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-[#0d0d0f] border-t border-[#2a2a2d] flex justify-between text-[12px]">
            <span className="text-[#606065]">Total interest earned</span>
            <span className="text-[#4ade80] font-semibold">{formatINR(fd.totalInterest)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  reportId: string;
  reportData: FDReportData;
  bankName: string;
  accountHolderName?: string;
  accountNumber?: string;
  statementPdfUrl?: string;
  statementFromDate?: string;
  statementToDate?: string;
  createdAt: string;
};

export function ReportView({ reportId, reportData, bankName, accountHolderName, accountNumber, statementFromDate, statementToDate, createdAt }: Props) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalInterest = reportData.fds.reduce((s, f) => s + f.totalInterest, 0);
  const maturedCount = reportData.fds.filter((f) => f.closureType === "matured").length;
  const prematureCount = reportData.fds.filter((f) => f.closureType === "premature").length;
  const ongoingCount = reportData.fds.filter((f) => f.closureType === "ongoing").length;

  const downloadPdf = async () => {
    setPrinting(true);
    try {
      const { generateFDStatementReportPdf } = await import("@/lib/generate-fd-statement-report-pdf");
      await generateFDStatementReportPdf({
        reportData,
        bankName,
        accountHolderName,
        accountNumber,
        statementFromDate,
        statementToDate,
        generatedAt: new Date(),
      });
    } finally {
      setPrinting(false);
    }
  };

  const deleteReport = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/fd/statement-report/${reportId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Delete failed");
      }
      router.push("/dashboard/fd/statement-reports");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-[#0d0d0f] border border-[#2a2a2d] rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {accountHolderName && <p className="text-[13px] text-[#a0a0a5]">{accountHolderName}</p>}
            {accountNumber && <p className="text-[12px] text-[#606065] mt-0.5">A/C {accountNumber}</p>}
          </div>
          <div className="text-right">
            {statementFromDate && statementToDate && (
              <p className="text-[12px] text-[#606065]">
                {formatDate(statementFromDate)} – {formatDate(statementToDate)}
              </p>
            )}
            <p className="text-[11px] text-[#484850] mt-0.5">Added {formatDate(createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-4 flex-wrap pt-1 border-t border-[#1e1e21]">
          <div>
            <p className="text-[11px] text-[#606065]">Total FDs</p>
            <p className="text-[18px] font-bold text-[#ededed]">{reportData.fds.length}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#606065]">Total Interest</p>
            <p className="text-[18px] font-bold text-[#4ade80]">{formatINR(totalInterest)}</p>
          </div>
          {maturedCount > 0 && (
            <div>
              <p className="text-[11px] text-[#606065]">Matured</p>
              <p className="text-[18px] font-bold text-[#ededed]">{maturedCount}</p>
            </div>
          )}
          {prematureCount > 0 && (
            <div>
              <p className="text-[11px] text-[#606065]">Premature</p>
              <p className="text-[18px] font-bold text-[#fb923c]">{prematureCount}</p>
            </div>
          )}
          {ongoingCount > 0 && (
            <div>
              <p className="text-[11px] text-[#606065]">Ongoing</p>
              <p className="text-[18px] font-bold text-[#818cf8]">{ongoingCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={printing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#a0a0a5] text-[13px] font-semibold hover:border-[#3a3a3e] hover:text-[#e0e0e4] transition-all disabled:opacity-40"
        >
          {printing ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
          {printing ? "Generating…" : "Download PDF"}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#606065] text-[13px] font-semibold hover:border-[#ff385c] hover:text-[#ff385c] transition-all"
          >
            <Trash2 size={13} />
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[#a0a0a5]">Delete this report?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteReport}
                disabled={deleting}
                className="px-3 py-1.5 rounded-full bg-[rgba(255,56,92,0.15)] border border-[rgba(255,56,92,0.35)] text-[#ff385c] text-[12px] font-semibold hover:bg-[rgba(255,56,92,0.22)] transition-all disabled:opacity-40"
              >
                {deleting ? <Loader2 size={12} className="animate-spin inline" /> : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#606065] text-[12px] font-semibold hover:border-[#3a3a3e] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 text-[#fb923c] text-[13px] bg-[#2a1a0a] border border-[#4a2e0f] rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          {deleteError}
        </div>
      )}

      {/* Per-FD expandable rows */}
      <div className="space-y-2">
        {reportData.fds.map((fd) => (
          <FDRow key={fd.fdNumber} fd={fd} />
        ))}
      </div>
    </div>
  );
}
