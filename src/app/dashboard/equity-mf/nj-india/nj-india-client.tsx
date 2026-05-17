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
  Printer,
} from "lucide-react";
import { generateNJIndiaPdf } from "@/lib/generate-nj-india-pdf";
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
  const [printing, setPrinting] = useState(false);

  const latest = statements[0] ?? null;

  async function handlePrint() {
    if (!latest) return;
    setPrinting(true);
    try {
      await generateNJIndiaPdf({
        generatedAt: new Date(),
        investorName: latest.investorName,
        reportDate: latest.reportDate,
        summary: {
          totalInvested: latest.totalInvested,
          totalCurrentValue: latest.totalCurrentValue,
          totalGainLoss: latest.totalGainLoss,
          xirrPct: latest.weightedReturnPct,
          absoluteReturnPct: latest.absoluteReturnPct,
          schemeCount: latest.schemeCount,
        },
        schemes,
      });
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setPrinting(false);
    }
  }

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
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--border-strong)] bg-gradient-to-br from-[var(--surface-raised)] to-[var(--surface-deep)] hover:border-[var(--border-strong)]",
          uploading && "pointer-events-none opacity-70"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all",
            isDragActive
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--surface-muted)] text-[var(--text-primary)] group-hover:bg-[var(--surface-subtle)]"
          )}>
            {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} strokeWidth={2.2} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
              {uploading ? "Parsing your statement…" : isDragActive ? "Drop to upload" : "Upload NJ India valuation statement"}
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Drag & drop a PDF here, or click to browse. Max 5 MB. Uploads replace the current holdings view.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
            <Sparkles size={12} className="text-[var(--primary)]" />
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">Auto-parse</span>
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-2 text-[13px] text-[var(--accent-error)] bg-[var(--accent-error)]/10 border border-[var(--accent-error)]/20 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && !error && (
          <div className="mt-4 flex items-start gap-2 text-[13px] text-[var(--accent-success)] bg-[var(--accent-success)]/10 border border-[var(--accent-success)]/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {latest && <LatestSnapshotCards latest={latest} onPrint={handlePrint} printing={printing} />}
      {latest && schemes.length > 0 && <SchemesTable schemes={schemes} />}
      <UploadsList statements={statements} onDelete={handleDelete} deletingId={deletingId} />

      {!latest && (
        <div className="ab-card p-10 text-center">
          <FileText size={32} className="mx-auto text-[var(--text-secondary)]" />
          <p className="text-[16px] font-semibold text-[var(--text-primary)] mt-3">No statements uploaded yet</p>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Upload your NJ India Scheme-Wise Valuation Report to see your mutual fund holdings.</p>
        </div>
      )}
    </div>
  );
}

function LatestSnapshotCards({ latest, onPrint, printing }: { latest: NJStatementSummary; onPrint?: () => void; printing?: boolean }) {
  const gain = latest.totalGainLoss >= 0;
  const pnlPct = latest.totalInvested > 0 ? (latest.totalGainLoss / latest.totalInvested) * 100 : 0;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <CalendarDays size={13} />
          <span>
            As on{" "}
            <span className="text-[var(--text-primary)] font-semibold">
              {latest.reportDate ? formatDate(latest.reportDate) : formatDate(latest.createdAt)}
            </span>
          </span>
        </div>
        {onPrint && (
          <button
            onClick={onPrint}
            disabled={printing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] text-[13px] font-medium hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? "Generating…" : "Print PDF"}
          </button>
        )}
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
  const color = tone === "positive" ? "text-[var(--accent-success)]" : tone === "negative" ? "text-[var(--accent-error)]" : "text-[var(--text-primary)]";
  return (
    <div className="ab-card p-4">
      <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className={cn("mono text-[15px] sm:text-[18px] lg:text-[20px] font-semibold tabular-nums", color)}>{value}</p>
      {sub && <p className="text-[var(--text-secondary)] text-[12px] mt-1 font-medium">{sub}</p>}
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

  const thBase = "px-4 py-3 text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none";
  const thL = cn(thBase, "text-left");
  const thR = cn(thBase, "text-right");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight">Holdings</h2>
          <span className="ab-chip">{schemes.length}</span>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scheme…"
            className="pl-9 pr-3 py-2 text-[13px] bg-[var(--surface-raised)] border border-[var(--border-strong)] rounded-full text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] focus:shadow-[0_0_0_1px_var(--text-primary)] w-full sm:w-56 transition-all"
          />
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden ab-card overflow-auto max-h-[560px] divide-y divide-[var(--border)]">
        {grouped.map((g) => {
          const groupPositive = g.gain >= 0;
          const groupPnlPct = g.invested > 0 ? (g.gain / g.invested) * 100 : 0;
          return (
            <Fragment key={g.amc}>
              <div className="bg-[var(--surface-muted)]/70 px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider truncate">{g.amc}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-secondary)] mono shrink-0">{g.items.length}</span>
                </div>
                <span className={cn("mono text-[11px] font-semibold shrink-0", groupPositive ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]")}>
                  {groupPositive ? "+" : ""}{formatINR(g.gain)}
                  <span className="opacity-70 ml-1">({formatPercent(groupPnlPct)})</span>
                </span>
              </div>
              {g.items.map((s) => {
                const gain = s.currentValue - s.invested;
                const pnlPct = s.invested > 0 ? (gain / s.invested) * 100 : 0;
                const positive = gain >= 0;
                const initials = s.scheme.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                return (
                  <div key={s.serial} className="px-4 py-3 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--chip-success-bg)] flex items-center justify-center shrink-0 ring-1 ring-[var(--chip-success-border)]">
                        <span className="text-[11px] font-bold text-[var(--accent-success)]">{initials}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[13px] text-[var(--text-primary)] leading-tight">{s.scheme}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-secondary)] mono">{s.subType}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{s.units.toFixed(3)} units · {s.tenure}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Invested</p>
                        <p className="mono text-[12px] text-[var(--text-secondary)] font-medium">{formatINR(s.invested)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Value</p>
                        <p className="mono text-[12px] text-[var(--text-primary)] font-medium">{formatINR(s.currentValue)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Gain</p>
                        <p className={cn("mono text-[12px] font-semibold", positive ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]")}>
                          {positive ? "+" : ""}{formatINR(gain)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Abs %</p>
                        <p className={cn("mono text-[12px] font-medium", s.absoluteReturnPct != null && s.absoluteReturnPct >= 0 ? "text-[var(--accent-success)]" : s.absoluteReturnPct != null ? "text-[var(--accent-error)]" : "text-[var(--text-secondary)]")}>
                          {s.absoluteReturnPct != null ? `${s.absoluteReturnPct.toFixed(2)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">XIRR</p>
                        <p className={cn("mono text-[12px] font-medium", s.annualizedReturnPct != null && s.annualizedReturnPct >= 0 ? "text-[var(--accent-success)]" : s.annualizedReturnPct != null ? "text-[var(--accent-error)]" : "text-[var(--text-secondary)]")}>
                          {s.annualizedReturnPct != null ? `${s.annualizedReturnPct.toFixed(2)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Holding</p>
                        <p className="mono text-[12px] text-[var(--text-secondary)] font-medium">{s.holdingPct.toFixed(2)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
        {totalRows === 0 && (
          <div className="px-4 py-10 text-center text-[var(--text-secondary)] text-[13px]">No schemes match.</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block ab-card overflow-hidden">
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-[14px]">
            <thead className="bg-[var(--surface-muted)] sticky top-0 z-10 shadow-[0_1px_0_0_var(--border)]">
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
            <tbody className="divide-y divide-[var(--border)]">
              {grouped.map((g) => {
                const groupPositive = g.gain >= 0;
                const groupPnlPct = g.invested > 0 ? (g.gain / g.invested) * 100 : 0;
                return (
                  <Fragment key={g.amc}>
                    <tr className="bg-[var(--surface-muted)]/70 sticky-group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{g.amc}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-secondary)] mono">{g.items.length}</span>
                        </div>
                      </td>
                      <td colSpan={2} />
                      <td colSpan={4} className="px-4 py-2.5 text-right mono text-[11px]">
                        <span className={cn("font-semibold", groupPositive ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]")}>
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
                        <tr key={s.serial} className="hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--chip-success-bg)] flex items-center justify-center shrink-0 ring-1 ring-[var(--chip-success-border)]">
                          <span className="text-[11px] font-bold text-[var(--accent-success)]">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate max-w-[260px]">{s.scheme}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-secondary)] mono">{s.subType}</span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">· {s.units.toFixed(3)} units · {s.tenure}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right mono text-[var(--text-secondary)]">{formatINR(s.invested)}</td>
                    <td className="px-4 py-3 text-right mono text-[var(--text-primary)]">{formatINR(s.currentValue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("inline-flex items-center gap-0.5 mono font-semibold", positive ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]")}>
                        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {formatINR(Math.abs(gain))}
                        <span className="text-[11px] opacity-80">({formatPercent(pnlPct)})</span>
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right mono", s.absoluteReturnPct != null && s.absoluteReturnPct >= 0 ? "text-[var(--accent-success)]" : s.absoluteReturnPct != null ? "text-[var(--accent-error)]" : "text-[var(--text-secondary)]")}>
                      {s.absoluteReturnPct != null ? `${s.absoluteReturnPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className={cn("px-4 py-3 text-right mono", s.annualizedReturnPct != null && s.annualizedReturnPct >= 0 ? "text-[var(--accent-success)]" : s.annualizedReturnPct != null ? "text-[var(--accent-error)]" : "text-[var(--text-secondary)]")}>
                      {s.annualizedReturnPct != null ? `${s.annualizedReturnPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right mono text-[var(--text-secondary)]">{s.holdingPct.toFixed(2)}%</td>
                  </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {totalRows === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--text-secondary)] text-[13px]">No schemes match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SortIndicator({ col, active, dir }: { col: string; active: string; dir: "asc" | "desc" }) {
  if (col !== active) return <span className="text-[var(--text-tertiary)] ml-1 text-[10px]">⇅</span>;
  return <span className="text-[var(--text-primary)] ml-1 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>;
}

function UploadsList({ statements, onDelete, deletingId }: { statements: NJStatementSummary[]; onDelete: (id: string) => void; deletingId: string | null }) {
  if (statements.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight">Uploads</h2>
        <span className="ab-chip">{statements.length}</span>
      </div>
      <div className="ab-card overflow-hidden divide-y divide-[var(--border)]">
        {statements.map((s, idx) => {
          const isLatest = idx === 0;
          const gain = s.totalGainLoss >= 0;
          return (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface-muted)] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center shrink-0">
                <FileText size={16} className="text-[var(--text-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{s.fileName}</span>
                  {isLatest && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-success)]/15 text-[var(--accent-success)]">Active</span>}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mono mt-0.5">
                  {s.reportDate ? formatDate(s.reportDate) : formatDate(s.createdAt)} · {s.schemeCount} schemes · {formatINR(s.totalCurrentValue)}{" "}
                  <span className={gain ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"}>
                    ({gain ? "+" : ""}{formatINR(s.totalGainLoss)})
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={s.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
                  title="Open PDF"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  onClick={() => onDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-error)] hover:bg-[var(--accent-error)]/10 transition-colors disabled:opacity-50"
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
