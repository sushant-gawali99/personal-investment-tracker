"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, FileText, Loader2, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import type { FDReportData, FDEntry } from "@/lib/fd-statement-report/types";

function normalizeFdNum(s: string): string {
  return s.replace(/^FD[-\s]*/i, "").replace(/\s+/g, "").trim();
}

type Step = "upload" | "extracting" | "preview" | "saving" | "saved";

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

export function StatementReportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reportData, setReportData] = useState<FDReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const extract = async () => {
    if (!file) return;
    setStep("extracting");
    setError(null);

    const form = new FormData();
    form.append("pdfFile", file);

    try {
      const [extractRes, fdsRes] = await Promise.all([
        fetch("/api/fd/statement-report/extract", { method: "POST", body: form }),
        fetch("/api/fd"),
      ]);
      const json = await extractRes.json();
      if (!extractRes.ok) throw new Error(json.error ?? "Extraction failed");

      const data = json.data as FDReportData;

      if (fdsRes.ok) {
        const fdsJson = await fdsRes.json() as { fds: Array<{ id: string; fdNumber: string | null; bankName: string }> };
        const existingFds = fdsJson.fds;
        data.fds = data.fds.map((entry) => {
          const normalizedEntry = normalizeFdNum(entry.fdNumber);
          const match = existingFds.find(
            (f) => f.fdNumber && normalizeFdNum(f.fdNumber) === normalizedEntry
          );
          if (match) {
            return {
              ...entry,
              linkedFdId: match.id,
              linkedFdLabel: `${match.bankName} · ${match.fdNumber}`,
            };
          }
          return entry;
        });
      }

      setReportData(data);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed. Please try again.");
      setStep("upload");
    }
  };

  const save = async () => {
    if (!reportData || !file) return;
    setStep("saving");
    setError(null);

    try {
      let statementPdfUrl: string | undefined;

      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/fd/upload", { method: "POST", body: uploadForm });
      if (uploadRes.ok) {
        const uploadJson = await uploadRes.json();
        statementPdfUrl = uploadJson.url as string;
      }

      const saveRes = await fetch("/api/fd/statement-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData, statementPdfUrl }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error ?? "Save failed");

      router.push(`/dashboard/fd/statement-reports/${saveJson.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      setStep("preview");
    }
  };

  if (step === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-[var(--primary)] animate-spin" />
        <p className="text-[14px] text-[var(--text-secondary)]">Analysing statement and extracting FD transactions…</p>
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-[var(--primary)] animate-spin" />
        <p className="text-[14px] text-[var(--text-secondary)]">Saving report…</p>
      </div>
    );
  }

  if (step === "preview" && reportData) {
    const totalInterest = reportData.fds.reduce((s, f) => s + f.totalInterest, 0);
    const maturedCount = reportData.fds.filter((f) => f.closureType === "matured").length;
    const prematureCount = reportData.fds.filter((f) => f.closureType === "premature").length;
    const ongoingCount = reportData.fds.filter((f) => f.closureType === "ongoing").length;

    return (
      <div className="space-y-5">
        {/* Header card */}
        <div className="bg-[var(--surface-deep)] border border-[var(--border)] rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[18px] font-bold text-[var(--text-primary)]">{reportData.bankName}</p>
              {reportData.accountHolderName && (
                <p className="text-[15px] text-[var(--text-tertiary)] mt-0.5">{reportData.accountHolderName}</p>
              )}
              {reportData.accountNumber && (
                <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">A/C {reportData.accountNumber}</p>
              )}
            </div>
            {reportData.statementFromDate && reportData.statementToDate && (
              <p className="text-[14px] text-[var(--text-secondary)]">
                {formatDate(reportData.statementFromDate)} – {formatDate(reportData.statementToDate)}
              </p>
            )}
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

        {/* Per-FD expandable rows */}
        <div className="space-y-2">
          {reportData.fds.map((fd) => (
            <FDRow key={fd.fdNumber} fd={fd} />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[var(--status-premature)] text-[13px] bg-[var(--status-premature-bg)] border border-[var(--status-premature-border)] rounded-lg px-4 py-3">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setStep("upload"); setReportData(null); setFile(null); }}
            className="px-4 py-2 rounded-full bg-[var(--surface-deep)] border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-semibold hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-all"
          >
            Upload different file
          </button>
          <button
            type="button"
            onClick={save}
            className="px-5 py-2 rounded-full bg-[rgba(255,56,92,0.15)] border border-[rgba(255,56,92,0.35)] text-[var(--primary)] text-[13px] font-bold hover:bg-[rgba(255,56,92,0.22)] hover:border-[rgba(255,56,92,0.5)] transition-all flex items-center gap-2"
          >
            <CheckCircle2 size={14} />
            Save Report
          </button>
        </div>
      </div>
    );
  }

  // Upload step
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-16 cursor-pointer transition-all
          ${dragging ? "border-[var(--primary)] bg-[rgba(255,56,92,0.05)]" : "border-[var(--border)] bg-[var(--surface-deep)] hover:border-[var(--border-strong)]"}`}
      >
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onInputChange} />
        <div className="flex flex-col items-center gap-3 text-center px-6">
          {file ? (
            <>
              <FileText size={36} className="text-[var(--primary)]" />
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{file.name}</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">{(file.size / 1024).toFixed(0)} KB — click to change</p>
            </>
          ) : (
            <>
              <Upload size={36} className="text-[var(--text-tertiary)]" />
              <div>
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">Drop your bank statement PDF here</p>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">or click to browse · max 50 MB</p>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] max-w-sm">
                Works with passbooks, personal ledger PDFs, and savings account statements that show FD interest credits.
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[var(--status-premature)] text-[13px] bg-[var(--status-premature-bg)] border border-[var(--status-premature-border)] rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={extract}
        disabled={!file}
        className="px-6 py-2.5 rounded-full bg-[var(--primary)] text-white text-[13px] font-bold hover:bg-[#e0304f] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_16px_rgba(255,56,92,0.35)]"
      >
        <FileText size={14} />
        Extract FD Report
      </button>
    </div>
  );
}
