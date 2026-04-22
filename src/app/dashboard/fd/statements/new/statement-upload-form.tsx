"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TxnType, MatchCandidate } from "@/lib/fd-statement/types";
import { formatINR } from "@/lib/format";

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

export function StatementUploadForm({ banks }: { banks: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [bank, setBank] = useState(banks[0] ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResp | null>(null);
  const [txns, setTxns] = useState<ReviewTxn[]>([]);
  const [showOther, setShowOther] = useState(false);

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
        skip: t.type === "other",
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
      <form onSubmit={doParse} className="space-y-4 max-w-lg">
        <label className="block text-[13px] text-[#a0a0a5]">
          Bank
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="block w-full mt-1 bg-[#18181c] border border-[#2a2a2e] rounded px-3 py-2 text-[#ededed]"
            disabled={banks.length === 0}
          >
            {banks.length === 0 ? <option>No banks found — add an FD first</option> : banks.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="block text-[13px] text-[#a0a0a5]">
          Statement PDF
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full mt-1 text-[#ededed]"
          />
        </label>
        <button disabled={busy || !file || !bank} className="ab-btn ab-btn-accent">
          {busy ? "Parsing…" : "Parse"}
        </button>
        {error && <p className="text-red-400 text-[13px]">{error}</p>}
      </form>
    );
  }

  const filtered = txns.map((t, i) => ({ t, i })).filter(({ t }) => showOther || (t.type !== "other" && t.type !== "tds"));
  const matched = txns.filter((t) => t.fdId && !t.skip).length;
  const unmatched = txns.filter((t) => !t.fdId && !t.skip && t.type !== "other" && t.type !== "tds").length;

  return (
    <div className="space-y-4">
      <div className="text-[13px] text-[#a0a0a5] flex flex-wrap gap-4 items-center">
        <span><strong className="text-[#ededed]">{parsed?.txnCount}</strong> parsed via <em>{parsed?.parseMethod}</em></span>
        <span>Matched: <strong className="text-[#ededed]">{matched}</strong></span>
        <span>Unmatched: <strong className="text-[#ededed]">{unmatched}</strong></span>
        <label className="ml-auto inline-flex items-center gap-2">
          <input type="checkbox" checked={showOther} onChange={(e) => setShowOther(e.target.checked)} /> Show other / TDS
        </label>
      </div>
      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-[#ededed]">
            <thead className="text-[#a0a0a5] bg-[#1c1c20]">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Type</th>
                <th className="px-2 py-1 text-left">Particulars</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1 text-left">FD</th>
                <th className="px-2 py-1 text-center">Skip</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ t, i }) => {
                const needsAttention = !t.fdId && !t.skip && t.type !== "other" && t.type !== "tds";
                return (
                  <tr key={i} className={`border-t border-[#2a2a2e] ${needsAttention ? "bg-[#2b1d1d]" : ""}`}>
                    <td className="px-2 py-1">{t.txnDate}</td>
                    <td className="px-2 py-1">{t.type}</td>
                    <td className="px-2 py-1">{t.particulars}</td>
                    <td className="px-2 py-1 text-right">{t.credit > 0 ? `+${formatINR(t.credit)}` : `-${formatINR(t.debit)}`}</td>
                    <td className="px-2 py-1">
                      <select
                        value={t.fdId ?? ""}
                        onChange={(e) => setTxns((prev) => prev.map((x, j) => j === i ? { ...x, fdId: e.target.value || null } : x))}
                        className="bg-[#18181c] border border-[#2a2a2e] rounded px-2 py-1 text-[#ededed]"
                      >
                        <option value="">— unmatched —</option>
                        {parsed!.candidates.map((c) => <option key={c.fdId} value={c.fdId}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={t.skip} onChange={(e) => setTxns((prev) => prev.map((x, j) => j === i ? { ...x, skip: e.target.checked } : x))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setStep(1)} className="ab-btn ab-btn-ghost">Back</button>
        <button onClick={doSave} disabled={busy} className="ab-btn ab-btn-accent">{busy ? "Saving…" : "Save"}</button>
      </div>
      {error && <p className="text-red-400 text-[13px]">{error}</p>}
    </div>
  );
}
