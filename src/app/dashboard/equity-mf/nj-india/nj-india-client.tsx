"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  CalendarDays,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatINR, formatPercent, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NJStatementSummary {
  id: string;
  fileUrl: string;
  fileName: string;
  reportDate: string | null;
  totalInvested: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  weightedReturnPct: number | null;
  absoluteReturnPct: number | null;
  schemeCount: number;
  investorName: string | null;
  createdAt: string;
}

export interface NJSchemeRow {
  serial: number;
  scheme: string;
  subType: string;
  invested: number;
  units: number;
  currentValue: number;
  annualizedReturnPct: number | null;
  absoluteReturnPct: number | null;
  holdingPct: number;
  tenure: string;
}

type SortKey = "scheme" | "invested" | "currentValue" | "gain" | "holdingPct" | "absoluteReturnPct" | "annualizedReturnPct";

const AMC_PREFIXES = [
  "Aditya Birla Sun Life",
  "Nippon India",
  "Canara Robeco",
  "Franklin India",
  "Invesco India",
  "ICICI Prudential",
  "Mirae Asset",
  "Motilal Oswal",
  "Bandhan",
  "Quant",
  "Parag Parikh",
  "PPFAS",
  "Tata",
  "Axis",
  "HDFC",
  "HSBC",
  "Kotak",
  "SBI",
  "DSP",
  "UTI",
  "L&T",
  "Edelweiss",
  "Baroda",
  "PGIM",
  "Sundaram",
  "JM",
  "IDFC",
];

function extractAMC(scheme: string): string {
  for (const p of AMC_PREFIXES) {
    if (scheme.toLowerCase().startsWith(p.toLowerCase())) return p;
  }
  return scheme.split(" ")[0] ?? "Other";
}

interface Props {
  statements: NJStatementSummary[];
  schemes: NJSchemeRow[];
}

export function NJIndiaClient({ statements, schemes }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const latest = statements[0] ?? null;

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/nj-india/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed");
      setSuccess(`Parsed ${body.schemeCount} schemes · ${formatINR(body.totalCurrentValue)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: uploading,
  });

  async function handleDelete(id: string) {
    if (!confirm("Delete this statement? The extracted holdings will be removed.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/nj-india/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-dashed p-8 transition-all cursor-pointer group",
          isDragActive
            ? "border-[#ff385c] bg-[#ff385c]/5"
            : "border-[#3a3a3f] bg-gradient-to-br from-[#17171a] to-[#131316] hover:border-[#5a5a60]",
          uploading && "pointer-events-none opacity-70"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all",
            isDragActive
              ? "bg-[#ff385c] text-white"
              : "bg-[#1c1c20] text-[#ededed] group-hover:bg-[#222226]"
          )}>
            {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} strokeWidth={2.2} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#ededed]">
              {uploading ? "Parsing your statement…" : isDragActive ? "Drop to upload" : "Upload NJ India valuation statement"}
            </p>
            <p className="text-[13px] text-[#a0a0a5] mt-0.5">
              Drag & drop a PDF here, or click to browse. Max 5 MB. Uploads replace the current holdings view.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1c20] border border-[#2a2a2e]">
            <Sparkles size={12} className="text-[#ff385c]" />
            <span className="text-[11px] font-medium text-[#a0a0a5]">Auto-parse</span>
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-2 text-[13px] text-[#ff7a6e] bg-[#ff7a6e]/10 border border-[#ff7a6e]/20 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && !error && (
          <div className="mt-4 flex items-start gap-2 text-[13px] text-[#5ee0a4] bg-[#5ee0a4]/10 border border-[#5ee0a4]/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {latest && <LatestSnapshotCards latest={latest} />}
      {latest && schemes.length > 0 && <SchemesTable schemes={schemes} />}
      <UploadsList statements={statements} onDelete={handleDelete} deletingId={deletingId} />

      {!latest && (
        <div className="ab-card p-10 text-center">
          <FileText size={32} className="mx-auto text-[#a0a0a5]" />
          <p className="text-[16px] font-semibold text-[#ededed] mt-3">No statements uploaded yet</p>
          <p className="text-[13px] text-[#a0a0a5] mt-1">Upload your NJ India Scheme-Wise Valuation Report to see your mutual fund holdings.</p>
        </div>
      )}
    </div>
  );
}

function LatestSnapshotCards({ latest }: { latest: NJStatementSummary }) {
  const gain = latest.totalGainLoss >= 0;
  const pnlPct = latest.totalInvested > 0 ? (latest.totalGainLoss / latest.totalInvested) * 100 : 0;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[12px] text-[#a0a0a5]">
          <CalendarDays size={13} />
          <span>
            As on{" "}
            <span className="text-[#ededed] font-semibold">
              {latest.reportDate ? formatDate(latest.reportDate) : formatDate(latest.createdAt)}
            </span>
          </span>
          {latest.investorName && (
            <>
              <span className="text-[#3a3a3f]">•</span>
              <span>{latest.investorName}</span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Invested" value={formatINR(latest.totalInvested)} />
        <StatCard label="Current Value" value={formatINR(latest.totalCurrentValue)} />
        <StatCard
          label="Gain / Loss"
          value={formatINR(latest.totalGainLoss)}
          sub={formatPercent(pnlPct)}
          tone={gain ? "positive" : "negative"}
        />
        <StatCard
          label="XIRR"
          value={latest.weightedReturnPct != null ? `${latest.weightedReturnPct.toFixed(2)}%` : "—"}
          sub={latest.absoluteReturnPct != null ? `Abs ${latest.absoluteReturnPct.toFixed(2)}%` : undefined}
          tone={latest.weightedReturnPct != null && latest.weightedReturnPct >= 0 ? "positive" : "neutral"}
        />
      </div>
    </section>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "positive" | "negative" | "neutral" }) {
  const color = tone === "positive" ? "text-[#5ee0a4]" : tone === "negative" ? "text-[#ff7a6e]" : "text-[#ededed]";
  return (
    <div className="ab-card p-4">
      <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className={cn("mono text-[20px] font-semibold", color)}>{value}</p>
      {sub && <p className="text-[#a0a0a5] text-[12px] mt-1 font-medium">{sub}</p>}
    </div>
  );
}

function SchemesTable({ schemes }: { schemes: NJSchemeRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scheme");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggle(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "scheme" ? "asc" : "desc"); }
  }

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? schemes.filter((s) => s.scheme.toLowerCase().includes(q) || s.subType.toLowerCase().includes(q))
      : schemes;
    const sorted = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "scheme") return dir * a.scheme.localeCompare(b.scheme);
      if (sortKey === "gain") return dir * ((a.currentValue - a.invested) - (b.currentValue - b.invested));
      const av = (a[sortKey] ?? 0) as number;
      const bv = (b[sortKey] ?? 0) as number;
      return dir * (av - bv);
    });
    const map = new Map<string, NJSchemeRow[]>();
    for (const r of sorted) {
      const amc = extractAMC(r.scheme);
      const list = map.get(amc) ?? [];
      list.push(r);
      map.set(amc, list);
    }
    return [...map.entries()]
      .map(([amc, items]) => {
        const invested = items.reduce((s, r) => s + r.invested, 0);
        const currentValue = items.reduce((s, r) => s + r.currentValue, 0);
        return { amc, items, invested, currentValue, gain: currentValue - invested };
      })
      .sort((a, b) => a.amc.localeCompare(b.amc));
  }, [schemes, search, sortKey, sortDir]);

  const totalRows = grouped.reduce((n, g) => n + g.items.length, 0);

  const thBase = "px-4 py-3 text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold cursor-pointer hover:text-[#ededed] transition-colors select-none";
  const thL = cn(thBase, "text-left");
  const thR = cn(thBase, "text-right");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-semibold text-[#ededed] tracking-tight">Holdings</h2>
          <span className="ab-chip">{schemes.length}</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0a5]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scheme…"
            className="pl-9 pr-3 py-2 text-[13px] bg-[#17171a] border border-[#3a3a3f] rounded-full text-[#ededed] placeholder:text-[#6e6e73] focus:outline-none focus:border-[#ededed] focus:shadow-[0_0_0_1px_#ededed] w-56 transition-all"
          />
        </div>
      </div>

      <div className="ab-card overflow-hidden">
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-[14px]">
            <thead className="bg-[#1c1c20] sticky top-0 z-10 shadow-[0_1px_0_0_#2a2a2e]">
              <tr>
                <th className={thL} onClick={() => toggle("scheme")}>Scheme <SortIndicator col="scheme" active={sortKey} dir={sortDir} /></th>
                <th className={thR} onClick={() => toggle("invested")}>Invested <SortIndicator col="invested" active={sortKey} dir={sortDir} /></th>
                <th className={thR} onClick={() => toggle("currentValue")}>Value <SortIndicator col="currentValue" active={sortKey} dir={sortDir} /></th>
                <th className={thR} onClick={() => toggle("gain")}>Gain <SortIndicator col="gain" active={sortKey} dir={sortDir} /></th>
                <th className={thR} onClick={() => toggle("absoluteReturnPct")}>Abs % <SortIndicator col="absoluteReturnPct" active={sortKey} dir={sortDir} /></th>
                <th className={thR} onClick={() => toggle("annualizedReturnPct")}>XIRR <SortIndicator col="annualizedReturnPct" active={sortKey} dir={sortDir} /></th>
                <th className={thR} onClick={() => toggle("holdingPct")}>% Holding <SortIndicator col="holdingPct" active={sortKey} dir={sortDir} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2e]">
              {grouped.map((g) => {
                const groupPositive = g.gain >= 0;
                const groupPnlPct = g.invested > 0 ? (g.gain / g.invested) * 100 : 0;
                return (
                  <Fragment key={g.amc}>
                    <tr className="bg-[#1c1c20]/70 sticky-group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-[#ededed] uppercase tracking-wider">{g.amc}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222226] text-[#a0a0a5] mono">{g.items.length}</span>
                        </div>
                      </td>
                      <td colSpan={2} />
                      <td colSpan={4} className="px-4 py-2.5 text-right mono text-[11px]">
                        <span className={cn("font-semibold", groupPositive ? "text-[#5ee0a4]" : "text-[#ff7a6e]")}>
                          {groupPositive ? "+" : ""}{formatINR(g.gain)}
                          <span className="opacity-70 ml-1">({formatPercent(groupPnlPct)})</span>
                        </span>
                      </td>
                    </tr>
                    {g.items.map((s) => {
                      const gain = s.currentValue - s.invested;
                      const pnlPct = s.invested > 0 ? (gain / s.invested) * 100 : 0;
                      const positive = gain >= 0;
                      const initials = s.scheme.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                      return (
                        <tr key={s.serial} className="hover:bg-[#1c1c20] transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1a2a20] flex items-center justify-center shrink-0 ring-1 ring-[#2a3a2e]">
                          <span className="text-[11px] font-bold text-[#5ee0a4]">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px] text-[#ededed] truncate max-w-[260px]">{s.scheme}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222226] text-[#a0a0a5] mono">{s.subType}</span>
                            <span className="text-[10px] text-[#6e6e73]">· {s.units.toFixed(3)} units · {s.tenure}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(s.invested)}</td>
                    <td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(s.currentValue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("inline-flex items-center gap-0.5 mono font-semibold", positive ? "text-[#5ee0a4]" : "text-[#ff7a6e]")}>
                        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {formatINR(Math.abs(gain))}
                        <span className="text-[11px] opacity-80">({formatPercent(pnlPct)})</span>
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right mono", s.absoluteReturnPct != null && s.absoluteReturnPct >= 0 ? "text-[#5ee0a4]" : s.absoluteReturnPct != null ? "text-[#ff7a6e]" : "text-[#a0a0a5]")}>
                      {s.absoluteReturnPct != null ? `${s.absoluteReturnPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className={cn("px-4 py-3 text-right mono", s.annualizedReturnPct != null && s.annualizedReturnPct >= 0 ? "text-[#5ee0a4]" : s.annualizedReturnPct != null ? "text-[#ff7a6e]" : "text-[#a0a0a5]")}>
                      {s.annualizedReturnPct != null ? `${s.annualizedReturnPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right mono text-[#a0a0a5]">{s.holdingPct.toFixed(2)}%</td>
                  </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {totalRows === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#a0a0a5] text-[13px]">No schemes match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SortIndicator({ col, active, dir }: { col: string; active: string; dir: "asc" | "desc" }) {
  if (col !== active) return <span className="text-[#6e6e73] ml-1 text-[10px]">⇅</span>;
  return <span className="text-[#ededed] ml-1 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>;
}

function UploadsList({ statements, onDelete, deletingId }: { statements: NJStatementSummary[]; onDelete: (id: string) => void; deletingId: string | null }) {
  if (statements.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-[18px] font-semibold text-[#ededed] tracking-tight">Uploads</h2>
        <span className="ab-chip">{statements.length}</span>
      </div>
      <div className="ab-card overflow-hidden divide-y divide-[#2a2a2e]">
        {statements.map((s, idx) => {
          const isLatest = idx === 0;
          const gain = s.totalGainLoss >= 0;
          return (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[#1c1c20] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#1c1c20] flex items-center justify-center shrink-0">
                <FileText size={16} className="text-[#a0a0a5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#ededed] truncate">{s.fileName}</span>
                  {isLatest && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#5ee0a4]/15 text-[#5ee0a4]">Active</span>}
                </div>
                <p className="text-[11px] text-[#a0a0a5] mono mt-0.5">
                  {s.reportDate ? formatDate(s.reportDate) : formatDate(s.createdAt)} · {s.schemeCount} schemes · {formatINR(s.totalCurrentValue)}{" "}
                  <span className={gain ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}>
                    ({gain ? "+" : ""}{formatINR(s.totalGainLoss)})
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={s.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#222226] transition-colors"
                  title="Open PDF"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  onClick={() => onDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="p-2 rounded-lg text-[#a0a0a5] hover:text-[#ff7a6e] hover:bg-[#ff7a6e]/10 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === s.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
