"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
      if (data.status === "preview") {
        stopPolling();
        setRows(data.stagedTransactions);
        setSummary({ new: data.newCount, dup: data.duplicateCount });
        setStatus("ready");
        setBusy(false);
        setStep(2);
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

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;
    setBusy(true); setError(null); setStatus("uploading"); setElapsedSec(0);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", accountId);
    const up = await fetch("/api/bank-accounts/import/upload", { method: "POST", body: fd });
    if (!up.ok) { setError((await up.json()).error); setBusy(false); setStatus("idle"); return; }
    const { importId: newId } = (await up.json()) as { importId: string };
    setImportId(newId);

    // Kick off extraction — route returns 202 immediately, work runs in background.
    setStatus("extracting");
    const ex = await fetch(`/api/bank-accounts/import/${newId}/extract`, { method: "POST" });
    if (!ex.ok) { setError((await ex.json()).error); setBusy(false); setStatus("idle"); return; }

    // Poll status every 2s; tick the elapsed counter every 1s for UX.
    const startedAt = Date.now();
    tickRef.current = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);
    pollRef.current = setInterval(() => checkStatus(newId), 2000);
    // Run one immediate check in case it already finished fast.
    void checkStatus(newId);
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

  if (step === 1) {
    return (
      <form onSubmit={onUpload} className="ab-card p-4 space-y-3 max-w-xl">
        <label className="block">
          <span className="block text-sm mb-1">Account</span>
          <select className="ab-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm mb-1">PDF</span>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button disabled={busy || !file || !accountId} className="ab-btn ab-btn-accent">
          {status === "uploading" && "Uploading…"}
          {status === "extracting" && `Extracting… ${elapsedSec}s`}
          {status === "idle" && "Upload & Extract"}
          {status === "ready" && "Upload & Extract"}
        </button>
        {status === "extracting" && (
          <p className="text-xs text-[#a0a0a5]">
            Claude is reading your statement. This typically takes 20–45 seconds for a busy month.
            You can leave this page open — progress is saved on the server.
          </p>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-3">
        {summary && (
          <p className="text-sm text-[#a0a0a5]">
            {summary.new} new · {summary.dup} duplicates auto-skipped · edit below, then commit.
          </p>
        )}
        <table className="w-full text-xs ab-card">
          <thead><tr className="text-left text-[#a0a0a5]">
            <th className="p-2">Date</th><th className="p-2">Description</th>
            <th className="p-2 text-right">Amount</th><th className="p-2">Dir</th>
            <th className="p-2">Category</th><th className="p-2">Skip</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-[#2a2a2e] ${r.isDuplicate ? "opacity-50" : ""}`}>
                <td className="p-2">{r.txnDate}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2 text-right">{r.amount.toFixed(2)}</td>
                <td className="p-2">{r.direction}</td>
                <td className="p-2">
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
        <div className="flex gap-2">
          <button className="ab-btn ab-btn-ghost" onClick={() => setStep(1)}>Back</button>
          <button className="ab-btn ab-btn-accent" onClick={onCommit} disabled={busy}>{busy ? "Committing…" : "Commit Import"}</button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="ab-card p-4 space-y-3">
      <p>Import saved. Open the <a className="underline" href="/dashboard/bank-accounts">overview</a> to see analytics, or <a className="underline" href="/dashboard/bank-accounts/list">list</a> to browse.</p>
    </div>
  );
}
