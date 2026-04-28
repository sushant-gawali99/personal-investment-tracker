"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Printer, Trash2, Loader2, AlertTriangle, Link2, RefreshCw, X } from "lucide-react";
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
        title={expanded ? undefined : "Open for details"}
        className="w-full flex items-start gap-2 px-4 py-3 bg-[#111114] hover:bg-[#161618] transition-colors text-left cursor-pointer"
      >
        {expanded
          ? <ChevronDown size={16} className="text-[#b0b0b8] shrink-0 mt-0.5" />
          : <ChevronRight size={16} className="text-[#b0b0b8] shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[#ededed] truncate">
              <span className="text-[#b0b0b8] font-normal">FD No.: </span>{fd.fdNumber}
            </span>
            <span className={`text-[13px] px-2.5 py-0.5 rounded-full border ${colorClass} shrink-0`}>
              {fd.closureType}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] text-[#4ade80] font-semibold">+{formatINR(fd.totalInterest)}</span>
            {fd.principalReturned != null && (
              <span className="text-[14px] text-[#dcdce4]">P: {formatINR(fd.principalReturned)}</span>
            )}
            {fd.closureDate && (
              <span className="text-[13px] text-[#b0b0b8]">{formatDate(fd.closureDate)}</span>
            )}
            {fd.linkedFdId && (
              <Link
                href={`/dashboard/fd/${fd.linkedFdId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[13px] px-2.5 py-0.5 rounded-full border border-[rgba(255,56,92,0.35)] text-[#ff385c] bg-[rgba(255,56,92,0.08)] hover:bg-[rgba(255,56,92,0.15)] transition-colors"
              >
                <Link2 size={11} />
                In system
              </Link>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2a2a2d]">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#0d0d0f]">
                  <th className="text-left px-3 py-2.5 text-[#b0b0b8] font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2.5 text-[#b0b0b8] font-medium hidden sm:table-cell">Description</th>
                  <th className="text-left px-3 py-2.5 text-[#b0b0b8] font-medium">Type</th>
                  <th className="text-right px-3 py-2.5 text-[#b0b0b8] font-medium whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fd.transactions.map((t, i) => (
                  <tr key={i} className="border-t border-[#1e1e21]">
                    <td className="px-3 py-2.5 text-[#dcdce4] whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2.5 text-[#dcdce4] max-w-[180px] truncate hidden sm:table-cell">{t.description}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] px-1.5 py-0.5 rounded bg-[#1e1e21] text-[#dcdce4] whitespace-nowrap">
                        {TXN_TYPE_LABELS[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#ededed] font-medium whitespace-nowrap">
                      {formatINR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2.5 bg-[#0d0d0f] border-t border-[#2a2a2d] flex justify-between text-[13px]">
            <span className="text-[#b0b0b8]">Total interest earned</span>
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
  isSuperAdmin?: boolean;
};

export function ReportView({ reportId, reportData, bankName, accountHolderName, accountNumber, statementPdfUrl, statementFromDate, statementToDate, createdAt, isSuperAdmin }: Props) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadError, setReuploadError] = useState<string | null>(null);

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

  const handleReextract = async () => {
    if (!statementPdfUrl) return;
    setReuploading(true);
    setReuploadError(null);

    try {
      const pdfRes = await fetch(statementPdfUrl);
      if (!pdfRes.ok) throw new Error("Could not fetch stored PDF");
      const blob = await pdfRes.blob();
      const file = new File([blob], "statement.pdf", { type: "application/pdf" });

      const form = new FormData();
      form.append("pdfFile", file);
      const extractRes = await fetch("/api/fd/statement-report/extract", { method: "POST", body: form });
      const extractJson = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractJson.error ?? "Extraction failed");

      const patchRes = await fetch(`/api/fd/statement-report/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData: extractJson.data }),
      });
      if (!patchRes.ok) {
        const j = await patchRes.json();
        throw new Error(j.error ?? "Update failed");
      }

      router.refresh();
    } catch (err) {
      setReuploadError(err instanceof Error ? err.message : "Re-extraction failed. Please try again.");
    } finally {
      setReuploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-[#0d0d0f] border border-[#2a2a2d] rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {accountHolderName && <p className="text-[15px] text-[#dcdce4]">{accountHolderName}</p>}
            {accountNumber && <p className="text-[14px] text-[#b0b0b8] mt-0.5">A/C {accountNumber}</p>}
          </div>
          <div className="text-right">
            {statementFromDate && statementToDate && (
              <p className="text-[14px] text-[#b0b0b8]">
                {formatDate(statementFromDate)} – {formatDate(statementToDate)}
              </p>
            )}
            <p className="text-[13px] text-[#b0b0b8] mt-0.5">Added {formatDate(createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-5 flex-wrap pt-2 border-t border-[#1e1e21]">
          <div>
            <p className="text-[13px] text-[#b0b0b8]">Total FDs</p>
            <p className="text-[22px] font-bold text-[#ededed]">{reportData.fds.length}</p>
          </div>
          <div>
            <p className="text-[13px] text-[#b0b0b8]">Total Interest</p>
            <p className="text-[22px] font-bold text-[#4ade80]">{formatINR(totalInterest)}</p>
          </div>
          {maturedCount > 0 && (
            <div>
              <p className="text-[13px] text-[#b0b0b8]">Matured</p>
              <p className="text-[22px] font-bold text-[#ededed]">{maturedCount}</p>
            </div>
          )}
          {prematureCount > 0 && (
            <div>
              <p className="text-[13px] text-[#b0b0b8]">Premature</p>
              <p className="text-[22px] font-bold text-[#fb923c]">{prematureCount}</p>
            </div>
          )}
          {ongoingCount > 0 && (
            <div>
              <p className="text-[13px] text-[#b0b0b8]">Ongoing</p>
              <p className="text-[22px] font-bold text-[#818cf8]">{ongoingCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {isSuperAdmin && statementPdfUrl && (
          <button
            type="button"
            onClick={handleReextract}
            disabled={reuploading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#a0a0a5] text-[13px] font-semibold hover:border-[#3a3a3e] hover:text-[#e0e0e4] transition-all disabled:opacity-40"
          >
            {reuploading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {reuploading ? "Re-extracting…" : "Re-extract"}
          </button>
        )}
        {reuploadError && (
          <span className="text-[13px] text-[#fb923c] flex items-center gap-1">
            <AlertTriangle size={13} />
            {reuploadError}
          </span>
        )}
        <button
          type="button"
          onClick={downloadPdf}
          disabled={printing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#a0a0a5] text-[13px] font-semibold hover:border-[#3a3a3e] hover:text-[#e0e0e4] transition-all disabled:opacity-40"
        >
          {printing ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
          {printing ? "Generating…" : "Download PDF"}
        </button>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#b0b0b8] text-[13px] font-semibold hover:border-[#ff385c] hover:text-[#ff385c] transition-all"
          >
            <Trash2 size={13} />
            Delete
          </button>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 text-[#fb923c] text-[13px] bg-[#2a1a0a] border border-[#4a2e0f] rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          {deleteError}
        </div>
      )}

      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[#2a2a2e] overflow-hidden" style={{ background: "#131316" }}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2a2a2e]">
              <AlertTriangle size={16} style={{ color: "#ff7a6e" }} />
              <p className="text-[15px] font-semibold text-[#ededed] tracking-tight flex-1">Delete this report?</p>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#b0b0b8] hover:bg-[#1c1c20] transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-[14px] text-[#dcdce4]">
                This will permanently delete this FD interest report. The original bank statement PDF will remain on the server.
              </p>
              <p className="text-[13px] text-[#b0b0b8] mt-2">This action cannot be undone.</p>
            </div>
            <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="ab-btn ab-btn-ghost w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteReport}
                disabled={deleting}
                className="ab-btn ab-btn-secondary w-full sm:w-auto"
                style={{ color: "#ff7a6e", borderColor: "rgba(255, 122, 110, 0.3)" }}
              >
                {deleting
                  ? <><Loader2 size={13} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={13} /> Delete permanently</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
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
