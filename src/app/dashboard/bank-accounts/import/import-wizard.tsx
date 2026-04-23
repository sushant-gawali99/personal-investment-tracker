"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Shield,
  UploadCloud,
  XCircle,
} from "lucide-react";

interface Account { id: string; label: string; bankName: string; }
interface CategoryLite { id: string; name: string; kind: string; }

type StagedRow = {
  txnDate: string;
  valueDate: string | null;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  runningBalance: number | null;
  bankRef: string | null;
  normalizedDescription: string;
  categoryId: string | null;
  categorySource: string | null;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  skip: boolean;
};

export function ImportWizard({ accounts, categories }: { accounts: Account[]; categories: CategoryLite[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ new: number; dup: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "ready">("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  useEffect(() => () => stopPolling(), []);

  async function checkStatus(id: string) {
    try {
      const r = await fetch(`/api/bank-accounts/import/${id}`);
      if (!r.ok) return;
      const data = await r.json() as {
        status: string;
        errorMessage: string | null;
        stagedTransactions: StagedRow[];
        newCount: number;
        duplicateCount: number;
      };
      if (data.status === "saved" || data.status === "preview") {
        stopPolling();
        setRows(data.stagedTransactions);
        setSummary({ new: data.newCount, dup: data.duplicateCount });
        setStatus("ready");
        setBusy(false);
        setStep(3);
        router.refresh();
      } else if (data.status === "failed") {
        stopPolling();
        setError(data.errorMessage ?? "Extraction failed");
        setStatus("idle");
        setBusy(false);
      }
    } catch {
      /* transient network error; keep polling */
    }
  }

  async function startUpload() {
    if (!file || !accountId) return;
    setBusy(true); setError(null); setStatus("uploading"); setElapsedSec(0);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", accountId);
    const up = await fetch("/api/bank-accounts/import/upload", { method: "POST", body: fd });
    if (!up.ok) { setError((await up.json()).error); setBusy(false); setStatus("idle"); return; }
    const { importId: newId } = (await up.json()) as { importId: string };
    setImportId(newId);

    setStatus("extracting");
    const ex = await fetch(`/api/bank-accounts/import/${newId}/extract`, { method: "POST" });
    if (!ex.ok) { setError((await ex.json()).error); setBusy(false); setStatus("idle"); return; }

    const startedAt = Date.now();
    tickRef.current = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);
    pollRef.current = setInterval(() => checkStatus(newId), 2000);
    void checkStatus(newId);
  }

  function onUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    void startUpload();
  }

  function patchRow(i: number, patch: Partial<StagedRow>) {
    setRows((prev) => prev.map((r, j) => j === i ? { ...r, ...patch } : r));
  }

  async function onCommit() {
    if (!importId) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/bank-accounts/import/${importId}/commit`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ txns: rows }),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error); return; }
    setStep(3);
    router.refresh();
  }

  function resetForAnother() {
    setStep(1);
    setFile(null);
    setImportId(null);
    setRows([]);
    setSummary(null);
    setStatus("idle");
    setError(null);
    setElapsedSec(0);
  }

  // ─── Step indicator ─────────────────────────────────────
  const steps = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Extract" },
    { n: 3, label: "Done" },
  ];
  const currentStep = status === "extracting" || status === "uploading" ? 2 : step;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => {
          const done = currentStep > s.n;
          const active = currentStep === s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  done
                    ? "bg-[#5ee0a4] text-[#0e0e11]"
                    : active
                    ? "bg-[#ff385c] text-white"
                    : "bg-[#1c1c20] text-[#6e6e73] border border-[#2a2a2e]"
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : s.n}
              </div>
              <span className={`text-[12px] font-semibold ${active ? "text-[#ededed]" : "text-[#6e6e73]"}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-8 h-[2px] ${done ? "bg-[#5ee0a4]" : "bg-[#2a2a2e]"}`} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <form onSubmit={onUploadSubmit} className="ab-card p-8 space-y-5 max-w-2xl mx-auto">
          <div>
            <label className="ab-label">Account</label>
            <select
              className="ab-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={status !== "idle"}
            >
              {accounts.length === 0 && <option value="">No accounts — add one first</option>}
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          <div>
            <label className="ab-label">Statement PDF</label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f && f.type === "application/pdf") setFile(f);
              }}
              className={`
                block relative border-2 border-dashed rounded-[14px] p-8 text-center cursor-pointer
                transition-all
                ${dragOver
                  ? "border-[#ff385c] bg-[rgba(255,56,92,0.06)]"
                  : file
                  ? "border-[#5ee0a4] bg-[rgba(94,224,164,0.05)]"
                  : "border-[#3a3a3f] bg-[#1c1c20]/40 hover:border-[#ededed] hover:bg-[#1c1c20]"
                }
                ${status !== "idle" ? "pointer-events-none opacity-60" : ""}
              `}
            >
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={status !== "idle"}
              />
              {file ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[rgba(94,224,164,0.15)] flex items-center justify-center mx-auto">
                    <FileText size={20} className="text-[#5ee0a4]" />
                  </div>
                  <p className="text-[14px] font-semibold text-[#ededed]">{file.name}</p>
                  <p className="text-[12px] text-[#a0a0a5]">{(file.size / 1024).toFixed(1)} KB · click to replace</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[rgba(255,56,92,0.12)] flex items-center justify-center mx-auto">
                    <UploadCloud size={22} className="text-[#ff385c]" />
                  </div>
                  <p className="text-[14px] font-semibold text-[#ededed]">
                    Drop your PDF here or click to browse
                  </p>
                  <p className="text-[12px] text-[#a0a0a5]">
                    Password-protected PDFs are not supported
                  </p>
                </div>
              )}
            </label>
          </div>

          <button
            type="submit"
            disabled={busy || !file || !accountId}
            className="ab-btn ab-btn-accent w-full py-3"
          >
            {status === "uploading" && <><Loader2 size={14} className="animate-spin" /> Uploading…</>}
            {status === "extracting" && <><Loader2 size={14} className="animate-spin" /> Extracting… {elapsedSec}s</>}
            {(status === "idle" || status === "ready") && <><UploadCloud size={14} /> Upload & Extract</>}
          </button>

          {status === "extracting" && (
            <div className="space-y-2">
              {/* Shimmer progress bar */}
              <div className="h-1 bg-[#1c1c20] rounded-full overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#ff385c] to-transparent"
                  style={{ width: "40%", animation: "ab-shimmer 1.4s linear infinite" }}
                />
              </div>
              <p className="text-[12px] text-[#a0a0a5] text-center">
                Reading statement — usually 1–5 seconds for known banks, up to 45s for unfamiliar formats.
                You can leave this page open; progress is saved.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgba(255,122,110,0.08)] border border-[rgba(255,122,110,0.25)]">
              <XCircle size={16} className="text-[#ff7a6e] shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#ff7a6e]">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-[#6e6e73] pt-1 border-t border-[#2a2a2e]">
            <Shield size={12} />
            <span>PDFs are stored locally — never sent to third parties except your chosen AI provider.</span>
          </div>

          <style jsx>{`
            @keyframes ab-shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {summary && (
            <p className="text-sm text-[#a0a0a5]">
              {summary.new} new · {summary.dup} duplicates auto-skipped · edit below, then commit.
            </p>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-xs ab-card">
            <thead><tr className="text-left text-[#a0a0a5]">
              <th className="p-2">Date</th><th className="p-2">Description</th>
              <th className="p-2 text-right">Amount</th><th className="p-2 hidden sm:table-cell">Dir</th>
              <th className="p-2 hidden md:table-cell">Category</th><th className="p-2">Skip</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-t border-[#2a2a2e] ${r.isDuplicate ? "opacity-50" : ""}`}>
                  <td className="p-2">{r.txnDate}</td>
                  <td className="p-2 max-w-[120px] sm:max-w-none truncate">{r.description}</td>
                  <td className="p-2 text-right">{r.amount.toFixed(2)}</td>
                  <td className="p-2 hidden sm:table-cell">{r.direction}</td>
                  <td className="p-2 hidden md:table-cell">
                    <select className="ab-input" value={r.categoryId ?? ""} onChange={(e) => patchRow(i, { categoryId: e.target.value || null, categorySource: "user" })}>
                      <option value="">— none —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={r.skip} onChange={(e) => patchRow(i, { skip: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="flex gap-2">
            <button className="ab-btn ab-btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="ab-btn ab-btn-accent" onClick={onCommit} disabled={busy}>{busy ? "Committing…" : "Commit Import"}</button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="ab-card p-10 max-w-2xl mx-auto text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-[rgba(94,224,164,0.12)] flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} className="text-[#5ee0a4]" />
          </div>
          <div>
            <h2 className="text-[22px] font-bold text-[#ededed] tracking-tight">Import saved</h2>
            {summary && (
              <p className="text-[14px] text-[#a0a0a5] mt-2">
                <span className="text-[#5ee0a4] font-semibold">{summary.new}</span> new transaction{summary.new === 1 ? "" : "s"} saved
                {summary.dup > 0 && <> · <span className="font-semibold">{summary.dup}</span> duplicate{summary.dup === 1 ? "" : "s"} auto-skipped</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 justify-center flex-wrap pt-2">
            <a href="/dashboard/bank-accounts" className="ab-btn ab-btn-accent">
              View Analytics <ArrowRight size={14} />
            </a>
            <a href="/dashboard/bank-accounts/list" className="ab-btn ab-btn-secondary">
              Browse Transactions
            </a>
            <button onClick={resetForAnother} className="ab-btn ab-btn-ghost">
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
