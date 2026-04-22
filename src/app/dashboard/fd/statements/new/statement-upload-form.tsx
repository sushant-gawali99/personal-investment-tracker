"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, ArrowLeft, Sparkles,
  TrendingUp, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, Minus, Circle,
} from "lucide-react";
import type { TxnType, MatchCandidate } from "@/lib/fd-statement/types";
import type { BankGroup } from "@/lib/fd-bank";
import { formatINR, formatDate } from "@/lib/format";

type ReviewTxn = {
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
  fdId: string | null;
  skip: boolean;
};

type ParseResp = {
  parseMethod: "regex" | "ai";
  fromDate: string;
  toDate: string;
  txnCount: number;
  matchedCount: number;
  candidates: MatchCandidate[];
  txns: (ReviewTxn & { match: unknown; suggestedFdId: string | null })[];
};

const TYPE_META: Record<string, { label: string; icon: typeof TrendingUp; tone: string }> = {
  interest:        { label: "Interest",         icon: TrendingUp,   tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  maturity:        { label: "Maturity",         icon: CheckCircle,  tone: "bg-[#0e2236] text-[#5ba8ff] border-[#173152]" },
  premature_close: { label: "Premature Close",  icon: XCircle,      tone: "bg-[#2a1f0d] text-[#f5a524] border-[#3a2d0f]" },
  transfer_in:     { label: "Transfer In",      icon: ArrowDownLeft,tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  transfer_out:    { label: "Transfer Out",     icon: ArrowUpRight, tone: "bg-[#2a1218] text-[#ff385c] border-[#3a1a22]" },
  tds:             { label: "TDS",              icon: Minus,        tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
  other:           { label: "Other",            icon: Circle,       tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function StatementUploadForm({ banks }: { banks: BankGroup[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [bankKey, setBankKey] = useState(banks[0]?.key ?? "");
  const selectedBank = banks.find((b) => b.key === bankKey);
  const bank = selectedBank?.label ?? "";
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResp | null>(null);
  const [txns, setTxns] = useState<ReviewTxn[]>([]);
  const [showOther, setShowOther] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPickFile(f: File | null | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }
    setError(null);
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    onPickFile(e.dataTransfer.files?.[0]);
  }

  async function doParse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file || !bank) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bankName", bank);
    const r = await fetch("/api/fd/statements/parse", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Parse failed");
      return;
    }
    const data = (await r.json()) as ParseResp;
    setParsed(data);
    setTxns(
      data.txns.map((t) => ({
        txnDate: t.txnDate,
        particulars: t.particulars,
        debit: t.debit,
        credit: t.credit,
        type: t.type,
        detectedFdNumber: t.detectedFdNumber,
        fdId: t.suggestedFdId,
        skip: false,
      })),
    );
    setStep(2);
  }

  async function doSave() {
    if (!parsed || !file) return;
    setBusy(true);
    setError(null);
    const up = new FormData();
    up.append("file", file);
    const ur = await fetch("/api/fd/upload", { method: "POST", body: up });
    if (!ur.ok) { setBusy(false); setError("PDF upload failed"); return; }
    const { url } = (await ur.json()) as { url: string };

    const res = await fetch("/api/fd/statements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bankName: bank,
        fileName: file.name,
        sourcePdfUrl: url,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        parseMethod: parsed.parseMethod,
        txns,
      }),
    });
    setBusy(false);
    if (!res.ok) { setError("Save failed"); return; }
    router.push("/dashboard/fd/statements");
    router.refresh();
  }

  if (step === 1) {
    return (
      <form onSubmit={doParse} className="max-w-2xl">
        <div className="ab-card p-7 space-y-6">
          {/* Bank */}
          <div>
            <label className="block text-[12px] font-medium text-[#a0a0a5] uppercase tracking-wider mb-2">
              Bank
            </label>
            <div className="relative">
              <select
                value={bankKey}
                onChange={(e) => setBankKey(e.target.value)}
                disabled={banks.length === 0}
                className="block w-full bg-[#18181c] border border-[#2a2a2e] rounded-lg px-4 py-2.5 text-[14px] text-[#ededed] appearance-none pr-10 focus:outline-none focus:border-[#ff385c] focus:ring-1 focus:ring-[#ff385c]/30 transition-colors"
              >
                {banks.length === 0
                  ? <option>No banks found — add an FD first</option>
                  : banks.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label} {b.count > 1 ? `(${b.count} FDs)` : ""}
                      </option>
                    ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#6e6e73]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <p className="text-[12px] text-[#6e6e73] mt-2">We&apos;ll match transactions against FDs at this bank.</p>
          </div>

          {/* File */}
          <div>
            <label className="block text-[12px] font-medium text-[#a0a0a5] uppercase tracking-wider mb-2">
              Statement PDF
            </label>
            {file ? (
              <div className="flex items-center gap-3 bg-[#18181c] border border-[#2a2a2e] rounded-lg px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-[#2a1218] flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-[#ff385c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#ededed] truncate">{file.name}</p>
                  <p className="text-[11px] text-[#6e6e73] mt-0.5">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                  className="w-7 h-7 rounded-md text-[#6e6e73] hover:text-[#ededed] hover:bg-[#24242a] flex items-center justify-center transition-colors"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors px-6 py-10 ${
                  dragActive
                    ? "border-[#ff385c] bg-[#2a1218]/40"
                    : "border-[#2a2a2e] hover:border-[#3a3a40] hover:bg-[#18181c]"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-[#24242a] flex items-center justify-center">
                  <Upload size={18} className="text-[#a0a0a5]" />
                </div>
                <p className="text-[13px] text-[#ededed] font-medium">
                  Drop a PDF here, or <span className="text-[#ff385c]">browse</span>
                </p>
                <p className="text-[11px] text-[#6e6e73]">PDF up to 10 MB</p>
              </label>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-[#2a1218]/60 border border-[#3a1a22] rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-[#ff7a8a] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#ff7a8a]">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={busy || !file || !bank}
              className="ab-btn ab-btn-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Sparkles size={14} className="animate-pulse" />
                  Parsing…
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Parse Statement
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    );
  }

  const filtered = txns.map((t, i) => ({ t, i })).filter(({ t }) => showOther || (t.type !== "other" && t.type !== "tds"));
  const matched = txns.filter((t) => t.fdId && !t.skip).length;
  const unmatched = txns.filter((t) => !t.fdId && !t.skip && t.type !== "other" && t.type !== "tds").length;
  const skipped = txns.filter((t) => t.skip).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total parsed" value={parsed?.txnCount ?? 0} hint={`via ${parsed?.parseMethod}`} />
        <StatCard label="Matched" value={matched} tone="success" />
        <StatCard label="Unmatched" value={unmatched} tone={unmatched > 0 ? "warning" : undefined} />
        <StatCard label="Period" value={parsed ? `${formatDate(parsed.fromDate)} → ${formatDate(parsed.toDate)}` : "—"} small />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[13px] text-[#a0a0a5]">
          Review matches below. {unmatched > 0 && <span className="text-[#f5a524]">{unmatched} need your attention.</span>}
        </p>
        <label className="inline-flex items-center gap-2 text-[12px] text-[#a0a0a5] cursor-pointer">
          <input
            type="checkbox"
            checked={showOther}
            onChange={(e) => setShowOther(e.target.checked)}
            className="accent-[#ff385c]"
          />
          Show TDS & other ({txns.length - filtered.length} hidden)
        </label>
      </div>

      {/* Table */}
      <div className="ab-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#6e6e73] bg-[#17171a] border-b border-[#222226]">
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-left font-medium px-3 py-3">Type</th>
                <th className="text-left font-medium px-3 py-3">Particulars</th>
                <th className="text-right font-medium px-3 py-3">Amount</th>
                <th className="text-left font-medium px-3 py-3 min-w-[200px]">FD</th>
                <th className="text-center font-medium px-4 py-3 w-20">Skip</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ t, i }) => {
                const meta = TYPE_META[t.type] ?? TYPE_META.other;
                const Icon = meta.icon;
                const isCredit = t.credit > 0;
                const needsAttention = !t.fdId && !t.skip && t.type !== "other" && t.type !== "tds";
                return (
                  <tr
                    key={i}
                    className={`border-t border-[#222226] transition-colors ${
                      t.skip ? "opacity-40" : ""
                    } ${needsAttention ? "bg-[#2a1f0d]/30" : "hover:bg-[#17171a]"}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-[#ededed]">{formatDate(t.txnDate)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                        <Icon size={11} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#a0a0a5] max-w-[24ch] truncate" title={t.particulars}>{t.particulars}</td>
                    <td className={`px-3 py-3 text-right mono font-semibold whitespace-nowrap ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                      {isCredit ? "+" : "−"}{formatINR(isCredit ? t.credit : t.debit)}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={t.fdId ?? ""}
                        onChange={(e) => setTxns((prev) => prev.map((x, j) => j === i ? { ...x, fdId: e.target.value || null } : x))}
                        className={`w-full bg-[#18181c] border rounded-md px-2.5 py-1.5 text-[12px] text-[#ededed] focus:outline-none focus:ring-1 focus:ring-[#ff385c]/30 ${
                          needsAttention ? "border-[#3a2d0f] focus:border-[#f5a524]" : "border-[#2a2a2e] focus:border-[#ff385c]"
                        }`}
                      >
                        <option value="">— Unmatched —</option>
                        {parsed!.candidates.map((c) => <option key={c.fdId} value={c.fdId}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={t.skip}
                        onChange={(e) => setTxns((prev) => prev.map((x, j) => j === i ? { ...x, skip: e.target.checked } : x))}
                        className="accent-[#ff385c]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-[#2a1218]/60 border border-[#3a1a22] rounded-lg px-3 py-2.5">
          <AlertCircle size={14} className="text-[#ff7a8a] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#ff7a8a]">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button onClick={() => setStep(1)} className="ab-btn ab-btn-ghost">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#a0a0a5]">
            Saving <strong className="text-[#ededed]">{txns.length - skipped}</strong> of {txns.length}
          </span>
          <button onClick={doSave} disabled={busy} className="ab-btn ab-btn-accent disabled:opacity-40">
            {busy ? (
              <>
                <Sparkles size={14} className="animate-pulse" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> Save Statement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, hint, tone, small,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "success" | "warning";
  small?: boolean;
}) {
  const toneColor =
    tone === "success" ? "text-[#5ee0a4]" :
    tone === "warning" ? "text-[#f5a524]" : "text-[#ededed]";
  return (
    <div className="ab-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#6e6e73] font-medium">{label}</p>
      <p className={`${small ? "text-[13px]" : "text-[20px]"} font-semibold mt-1.5 ${toneColor}`}>{value}</p>
      {hint && <p className="text-[11px] text-[#6e6e73] mt-0.5">{hint}</p>}
    </div>
  );
}
