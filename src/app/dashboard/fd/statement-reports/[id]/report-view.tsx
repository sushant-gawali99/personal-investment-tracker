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

const TXN_TYPE_COLORS: Record<string, string> = {
  interest_payout:    "bg-[var(--chip-success-bg)] text-[var(--accent-success)] border border-[var(--chip-success-border)]",
  maturity_interest:  "bg-[var(--chip-success-bg)] text-[var(--accent-success)] border border-[var(--chip-success-border)]",
  maturity_principal: "bg-[var(--chip-info-bg)] text-[var(--accent-info)] border border-[var(--chip-info-border)]",
  premature_principal:"bg-[var(--chip-warning-bg)] text-[var(--accent-warning)] border border-[var(--chip-warning-border)]",
  premature_interest: "bg-[var(--chip-warning-bg)] text-[var(--accent-warning)] border border-[var(--chip-warning-border)]",
  other:              "bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)]",
};

const CLOSURE_COLORS: Record<string, string> = {
  matured: "text-[var(--status-matured)] bg-[var(--status-matured-bg)] border-[var(--status-matured-border)]",
  premature: "text-[var(--status-premature)] bg-[var(--status-premature-bg)] border-[var(--status-premature-border)]",
  ongoing: "text-[var(--status-ongoing)] bg-[var(--status-ongoing-bg)] border-[var(--status-ongoing-border)]",
};

function FDRow({ fd }: { fd: FDEntry }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = CLOSURE_COLORS[fd.closureType] ?? CLOSURE_COLORS.ongoing;

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? undefined : "Open for details"}
        className="w-full flex items-start gap-2 px-4 py-3 bg-[var(--surface-deep)] hover:bg-[var(--surface-raised)] transition-colors text-left cursor-pointer"
      >
        {expanded
          ? <ChevronDown size={16} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
          : <ChevronRight size={16} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
              <span className="text-[var(--text-secondary)] font-normal">FD No.: </span>{fd.fdNumber}
            </span>
            <span className={`text-[13px] px-2.5 py-0.5 rounded-full border ${colorClass} shrink-0`}>
              {fd.closureType}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] text-[var(--status-matured)] font-semibold">+{formatINR(fd.totalInterest)}</span>
            {fd.principalReturned != null && (
              <span className="text-[14px] text-[var(--text-tertiary)]">P: {formatINR(fd.principalReturned)}</span>
            )}
            {fd.closureDate && (
              <span className="text-[13px] text-[var(--text-secondary)]">{formatDate(fd.closureDate)}</span>
            )}
            {fd.linkedFdId && (
              <Link
                href={`/dashboard/fd/${fd.linkedFdId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[13px] px-2.5 py-0.5 rounded-full border border-[rgba(255,56,92,0.35)] text-[var(--primary)] bg-[rgba(255,56,92,0.08)] hover:bg-[rgba(255,56,92,0.15)] transition-colors"
              >
                <Link2 size={11} />
                In system
              </Link>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--surface-deep)]">
                  <th className="text-left px-3 py-2.5 text-[var(--text-secondary)] font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2.5 text-[var(--text-secondary)] font-medium hidden sm:table-cell">Description</th>
                  <th className="text-left px-3 py-2.5 text-[var(--text-secondary)] font-medium">Type</th>
                  <th className="text-right px-3 py-2.5 text-[var(--text-secondary)] font-medium whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fd.transactions.map((t, i) => (
                  <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="px-3 py-2.5 text-[var(--text-primary)] whitespace-nowrap font-medium">{t.date}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)] max-w-[180px] truncate hidden sm:table-cell">{t.description}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${TXN_TYPE_COLORS[t.type] ?? TXN_TYPE_COLORS.other}`}>
                        {TXN_TYPE_LABELS[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--text-primary)] font-medium whitespace-nowrap">
                      {formatINR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2.5 bg-[var(--surface-deep)] border-t border-[var(--border)] flex justify-between text-[13px]">
            <span className="text-[var(--text-secondary)]">Total interest earned</span>
            <span className="text-[var(--status-matured)] font-semibold">{formatINR(fd.totalInterest)}</span>
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
      <div className="bg-[var(--surface-deep)] border border-[var(--border)] rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {accountHolderName && <p className="text-[15px] text-[var(--text-tertiary)]">{accountHolderName}</p>}
            {accountNumber && <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">A/C {accountNumber}</p>}
          </div>
          <div className="text-right">
            {statementFromDate && statementToDate && (
              <p className="text-[14px] text-[var(--text-secondary)]">
                {formatDate(statementFromDate)} – {formatDate(statementToDate)}
              </p>
            )}
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Added {formatDate(createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-5 flex-wrap pt-2 border-t border-[var(--border)]">
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">Total FDs</p>
            <p className="text-[22px] font-bold text-[var(--text-primary)]">{reportData.fds.length}</p>
          </div>
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">Total Interest</p>
            <p className="text-[22px] font-bold text-[var(--status-matured)]">{formatINR(totalInterest)}</p>
          </div>
          {maturedCount > 0 && (
            <div>
              <p className="text-[13px] text-[var(--text-secondary)]">Matured</p>
              <p className="text-[22px] font-bold text-[var(--text-primary)]">{maturedCount}</p>
            </div>
          )}
          {prematureCount > 0 && (
            <div>
              <p className="text-[13px] text-[var(--text-secondary)]">Premature</p>
              <p className="text-[22px] font-bold text-[var(--status-premature)]">{prematureCount}</p>
            </div>
          )}
          {ongoingCount > 0 && (
            <div>
              <p className="text-[13px] text-[var(--text-secondary)]">Ongoing</p>
              <p className="text-[22px] font-bold text-[var(--status-ongoing)]">{ongoingCount}</p>
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-deep)] border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-semibold hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40"
          >
            {reuploading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {reuploading ? "Re-extracting…" : "Re-extract"}
          </button>
        )}
        {reuploadError && (
          <span className="text-[13px] text-[var(--status-premature)] flex items-center gap-1">
            <AlertTriangle size={13} />
            {reuploadError}
          </span>
        )}
        <button
          type="button"
          onClick={downloadPdf}
          disabled={printing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-deep)] border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-semibold hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40"
        >
          {printing ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
          {printing ? "Generating…" : "Download PDF"}
        </button>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-deep)] border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
          >
            <Trash2 size={13} />
            Delete
          </button>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 text-[var(--status-premature)] text-[13px] bg-[var(--status-premature-bg)] border border-[var(--status-premature-border)] rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          {deleteError}
        </div>
      )}

      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--surface-deep)" }}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
              <AlertTriangle size={16} style={{ color: "var(--accent-error)" }} />
              <p className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Delete this report?</p>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-[14px] text-[var(--text-tertiary)]">
                This will permanently delete this FD interest report. The original bank statement PDF will remain on the server.
              </p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-2">This action cannot be undone.</p>
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
                style={{ color: "var(--accent-error)", borderColor: "rgba(255, 122, 110, 0.3)" }}
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
