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
          ? <ChevronDown size={16} className="text-[#9a9aa2] shrink-0 mt-0.5" />
          : <ChevronRight size={16} className="text-[#9a9aa2] shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[#ededed] truncate">
              <span className="text-[#9a9aa2] font-normal">FD No.: </span>{fd.fdNumber}
            </span>
            <span className={`text-[13px] px-2.5 py-0.5 rounded-full border ${colorClass} shrink-0`}>
              {fd.closureType}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] text-[#4ade80] font-semibold">+{formatINR(fd.totalInterest)}</span>
            {fd.principalReturned != null && (
              <span className="text-[14px] text-[#c8c8d2]">P: {formatINR(fd.principalReturned)}</span>
            )}
            {fd.closureDate && (
              <span className="text-[13px] text-[#9a9aa2]">{formatDate(fd.closureDate)}</span>
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
                  <th className="text-left px-3 py-2.5 text-[#9a9aa2] font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2.5 text-[#9a9aa2] font-medium hidden sm:table-cell">Description</th>
                  <th className="text-left px-3 py-2.5 text-[#9a9aa2] font-medium">Type</th>
                  <th className="text-right px-3 py-2.5 text-[#9a9aa2] font-medium whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fd.transactions.map((t, i) => (
                  <tr key={i} className="border-t border-[#1e1e21]">
                    <td className="px-3 py-2.5 text-[#c8c8d2] whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2.5 text-[#dcdce2] max-w-[180px] truncate hidden sm:table-cell">{t.description}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] px-1.5 py-0.5 rounded bg-[#1e1e21] text-[#c8c8d2] whitespace-nowrap">
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
            <span className="text-[#9a9aa2]">Total interest earned</span>
            <span className="text-[#4ade80] font-semibold">{formatINR(fd.totalInterest)}</span>
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
        <Loader2 size={32} className="text-[#ff385c] animate-spin" />
        <p className="text-[14px] text-[#a0a0a5]">Analysing statement and extracting FD transactions…</p>
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-[#ff385c] animate-spin" />
        <p className="text-[14px] text-[#a0a0a5]">Saving report…</p>
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
        <div className="bg-[#0d0d0f] border border-[#2a2a2d] rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[18px] font-bold text-[#ededed]">{reportData.bankName}</p>
              {reportData.accountHolderName && (
                <p className="text-[15px] text-[#c8c8d2] mt-0.5">{reportData.accountHolderName}</p>
              )}
              {reportData.accountNumber && (
                <p className="text-[14px] text-[#9a9aa2] mt-0.5">A/C {reportData.accountNumber}</p>
              )}
            </div>
            {reportData.statementFromDate && reportData.statementToDate && (
              <p className="text-[14px] text-[#9a9aa2]">
                {formatDate(reportData.statementFromDate)} – {formatDate(reportData.statementToDate)}
              </p>
            )}
          </div>
          <div className="flex gap-5 flex-wrap pt-2 border-t border-[#1e1e21]">
            <div>
              <p className="text-[13px] text-[#9a9aa2]">Total FDs</p>
              <p className="text-[22px] font-bold text-[#ededed]">{reportData.fds.length}</p>
            </div>
            <div>
              <p className="text-[13px] text-[#9a9aa2]">Total Interest</p>
              <p className="text-[22px] font-bold text-[#4ade80]">{formatINR(totalInterest)}</p>
            </div>
            {maturedCount > 0 && (
              <div>
                <p className="text-[13px] text-[#9a9aa2]">Matured</p>
                <p className="text-[22px] font-bold text-[#ededed]">{maturedCount}</p>
              </div>
            )}
            {prematureCount > 0 && (
              <div>
                <p className="text-[13px] text-[#9a9aa2]">Premature</p>
                <p className="text-[22px] font-bold text-[#fb923c]">{prematureCount}</p>
              </div>
            )}
            {ongoingCount > 0 && (
              <div>
                <p className="text-[13px] text-[#9a9aa2]">Ongoing</p>
                <p className="text-[22px] font-bold text-[#818cf8]">{ongoingCount}</p>
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
          <div className="flex items-center gap-2 text-[#fb923c] text-[13px] bg-[#2a1a0a] border border-[#4a2e0f] rounded-lg px-4 py-3">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setStep("upload"); setReportData(null); setFile(null); }}
            className="px-4 py-2 rounded-full bg-[#0d0d0f] border border-[#2a2a2d] text-[#a0a0a5] text-[13px] font-semibold hover:border-[#3a3a3e] hover:text-[#e0e0e4] transition-all"
          >
            Upload different file
          </button>
          <button
            type="button"
            onClick={save}
            className="px-5 py-2 rounded-full bg-[rgba(255,56,92,0.15)] border border-[rgba(255,56,92,0.35)] text-[#ff385c] text-[13px] font-bold hover:bg-[rgba(255,56,92,0.22)] hover:border-[rgba(255,56,92,0.5)] transition-all flex items-center gap-2"
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
          ${dragging ? "border-[#ff385c] bg-[rgba(255,56,92,0.05)]" : "border-[#2a2a2d] bg-[#0d0d0f] hover:border-[#3a3a3e]"}`}
      >
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onInputChange} />
        <div className="flex flex-col items-center gap-3 text-center px-6">
          {file ? (
            <>
              <FileText size={36} className="text-[#ff385c]" />
              <p className="text-[14px] font-semibold text-[#ededed]">{file.name}</p>
              <p className="text-[12px] text-[#606065]">{(file.size / 1024).toFixed(0)} KB — click to change</p>
            </>
          ) : (
            <>
              <Upload size={36} className="text-[#606065]" />
              <div>
                <p className="text-[14px] font-semibold text-[#ededed]">Drop your bank statement PDF here</p>
                <p className="text-[12px] text-[#606065] mt-1">or click to browse · max 50 MB</p>
              </div>
              <p className="text-[11px] text-[#484850] max-w-sm">
                Works with passbooks, personal ledger PDFs, and savings account statements that show FD interest credits.
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[#fb923c] text-[13px] bg-[#2a1a0a] border border-[#4a2e0f] rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={extract}
        disabled={!file}
        className="px-6 py-2.5 rounded-full bg-[#ff385c] text-white text-[13px] font-bold hover:bg-[#e0304f] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_16px_rgba(255,56,92,0.35)]"
      >
        <FileText size={14} />
        Extract FD Report
      </button>
    </div>
  );
}
