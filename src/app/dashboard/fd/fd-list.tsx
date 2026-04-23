"use client";

import Link from "next/link";
import { useState, Fragment, useMemo } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatDate, daysUntil, formatTenure } from "@/lib/format";
import { FDDetailContent, type FDDetailData } from "./fd-detail-content";
import { FDDisableButton } from "./fd-disable-button";

type FD = FDDetailData & { disabled: boolean };

type Filter = "all" | "active" | "matured" | "disabled";
type SortCol = "principal" | "rate" | "atMaturity";
type SortDir = "asc" | "desc";
type HeaderDef = {
  label: string;
  sortCol?: SortCol;
  align: "left" | "right" | "center";
  className?: string;
};

const HEADERS: HeaderDef[] = [
  { label: "Bank",        align: "left" },
  { label: "FD No.",      align: "left" },
  { label: "Principal",   align: "right", sortCol: "principal" },
  { label: "Rate",        align: "right", sortCol: "rate" },
  { label: "Tenure",      align: "left" },
  { label: "Duration",    align: "left" },
  { label: "At Maturity", align: "right", sortCol: "atMaturity" },
  { label: "Status",      align: "left" },
  { label: "",            align: "center", className: "w-[44px]" },
];
const COL_COUNT = HEADERS.length;

function normalizeBankName(name: string) {
  return name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
}

type Resolved = ReturnType<typeof resolveCurrent>;

function resolveCurrent(fd: FD) {
  const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
  return {
    principal: latest?.principal ?? fd.principal,
    interestRate: latest?.interestRate ?? fd.interestRate,
    tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
    tenureDays: latest?.tenureDays ?? fd.tenureDays,
    tenureText: latest?.tenureText ?? fd.tenureText,
    startDate: new Date(latest?.startDate ?? fd.startDate),
    maturityDate: new Date(latest?.maturityDate ?? fd.maturityDate),
    maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
  };
}

function StatusBadge({ fd, current, now }: { fd: FD; current: Resolved; now: Date }) {
  if (fd.disabled) return <span className="ab-chip">Disabled</span>;
  const isMatured = current.maturityDate <= now;
  if (isMatured) {
    const maturedDaysAgo = Math.floor((now.getTime() - current.maturityDate.getTime()) / 86400000);
    return (
      <span className="inline-flex items-center gap-1 ab-chip ab-chip-warning">
        <CheckCircle2 size={10} />
        {maturedDaysAgo === 0 ? "Matured today" : `Matured ${maturedDaysAgo}d ago`}
      </span>
    );
  }
  const days = daysUntil(current.maturityDate);
  if (days <= 7) return <span className="inline-flex items-center gap-1 ab-chip ab-chip-error"><AlertTriangle size={10} />{days}d left</span>;
  if (days <= 30) return <span className="ab-chip ab-chip-warning">{days}d left</span>;
  return <span className="ab-chip ab-chip-success">{days}d left</span>;
}

export function FDList({ fds }: { fds: FD[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
  const [fdSearch, setFdSearch] = useState("");
  const now = new Date();

  const resolvedForStats = useMemo(() => {
    const statsNow = new Date();
    const yearStart = new Date(statsNow.getFullYear(), 0, 1);
    const yearEnd = new Date(statsNow.getFullYear(), 11, 31);

    return fds
      .filter((fd) => {
        if (fd.disabled) return false;
        if (bankFilter !== "all" && normalizeBankName(fd.bankName) !== bankFilter) return false;
        return true;
      })
      .map((fd) => {
        const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
        const principal = latest?.principal ?? fd.principal;
        const interestRate = latest?.interestRate ?? fd.interestRate;
        const maturityAmount = latest?.maturityAmount ?? fd.maturityAmount;
        const startDate = new Date(latest?.startDate ?? fd.startDate);
        const maturityDate = new Date(latest?.maturityDate ?? fd.maturityDate);

        const overlapStart = startDate < yearStart ? yearStart : startDate;
        const overlapEnd = maturityDate > yearEnd ? yearEnd : maturityDate;
        const daysInYear = overlapStart < overlapEnd
          ? (overlapEnd.getTime() - overlapStart.getTime()) / 86400000
          : 0;
        const interestThisYear = (principal * interestRate / 100) * (daysInYear / 365);

        return { principal, interestRate, maturityAmount, maturityDate, interestThisYear };
      });
  }, [fds, bankFilter]);

  const stats = useMemo(() => {
    const totalPrincipal = resolvedForStats.reduce((s, r) => s + r.principal, 0);
    const totalMaturity = resolvedForStats.reduce((s, r) => s + (r.maturityAmount ?? r.principal), 0);
    const totalInterest = totalMaturity - totalPrincipal;
    const activeFDs = resolvedForStats.filter((r) => r.maturityDate > new Date()).length;
    const avgRate = resolvedForStats.length > 0
      ? resolvedForStats.reduce((s, r) => s + r.interestRate, 0) / resolvedForStats.length
      : 0;
    const interestThisYear = resolvedForStats.reduce((s, r) => s + r.interestThisYear, 0);
    return { totalPrincipal, totalMaturity, totalInterest, activeFDs, avgRate, interestThisYear };
  }, [resolvedForStats]);

  const bankMap = new Map<string, { label: string; count: number }>();
  for (const fd of fds) {
    const key = normalizeBankName(fd.bankName);
    const entry = bankMap.get(key);
    if (!entry) {
      bankMap.set(key, { label: fd.bankName.trim(), count: 1 });
    } else {
      entry.count += 1;
    }
  }
  const banks = Array.from(bankMap.entries())
    .map(([key, { label, count }]) => ({ key, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filtered = fds.filter((fd) => {
    if (filter === "disabled") {
      if (!fd.disabled) return false;
    } else {
      if (fd.disabled) return false;
      const matured = resolveCurrent(fd).maturityDate <= now;
      if (filter === "active" && matured) return false;
      if (filter === "matured" && !matured) return false;
    }
    if (bankFilter !== "all" && normalizeBankName(fd.bankName) !== bankFilter) return false;
    if (fdSearch.trim() && !(fd.fdNumber ?? "").toLowerCase().includes(fdSearch.trim().toLowerCase())) return false;
    return true;
  });

  const sorted = sort === null ? filtered : (() => {
    const key = (fd: FD): number => {
      const c = resolveCurrent(fd);
      switch (sort.col) {
        case "principal":  return c.principal;
        case "rate":       return c.interestRate;
        case "atMaturity": return c.maturityAmount ?? c.principal;
      }
    };
    return [...filtered].sort((a, b) => {
      const d = key(a) - key(b);
      return sort.dir === "asc" ? d : -d;
    });
  })();

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(col: SortCol) {
    setSort((prev) =>
      prev?.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" }
    );
  }

  if (fds.length === 0) {
    return (
      <div className="ab-card p-12 text-center">
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">No fixed deposits added yet</p>
        <p className="text-[14px] text-[#a0a0a5] mt-1.5">Upload an FD certificate to get started.</p>
      </div>
    );
  }

  const counts = {
    all: fds.filter((fd) => !fd.disabled).length,
    active: fds.filter((fd) => !fd.disabled && resolveCurrent(fd).maturityDate > now).length,
    matured: fds.filter((fd) => !fd.disabled && resolveCurrent(fd).maturityDate <= now).length,
    disabled: fds.filter((fd) => fd.disabled).length,
  };

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: "Total FD Corpus",    value: formatINR(stats.totalMaturity) },
          { label: "Avg Interest Rate",  value: `${stats.avgRate.toFixed(2)}%` },
          { label: "Active Deposits",    value: String(stats.activeFDs) },
          { label: "Interest This Year", value: formatINR(stats.interestThisYear) },
        ].map(({ label, value }) => (
          <div key={label} className="ab-card p-4">
            <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className="mono text-[15px] sm:text-[20px] font-semibold text-[#ededed]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ab-card-flat p-4 flex items-center justify-between">
          <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Principal</p>
          <p className="mono font-semibold text-[#ededed]">{formatINR(stats.totalPrincipal)}</p>
        </div>
        <div className="ab-card-flat p-4 flex items-center justify-between">
          <p className="text-[12px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Total Interest Earned</p>
          <p className="mono font-semibold text-[#5ee0a4]">{formatINR(stats.totalInterest)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status pills — equal-width on mobile, natural-width on desktop */}
        <div className="flex gap-1 p-1 bg-[#1c1c20] rounded-xl sm:rounded-full sm:inline-flex">
          {(["all", "active", "matured", "disabled"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 sm:flex-none text-center px-2 sm:px-4 py-1.5 rounded-lg sm:rounded-full text-[12px] sm:text-[13px] font-semibold transition-all capitalize",
                filter === f
                  ? "bg-[#17171a] text-[#ededed] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#a0a0a5] hover:text-[#ededed]"
              )}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        {/* Bank select + search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="bg-[#17171a] border border-[#3a3a3f] rounded-full px-4 py-2 text-[13px] font-semibold text-[#ededed] focus:outline-none focus:border-[#ededed] focus:shadow-[0_0_0_1px_#ededed] cursor-pointer transition-all w-full sm:w-auto"
          >
            <option value="all">All banks</option>
            {banks.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <input
            type="text"
            value={fdSearch}
            onChange={(e) => setFdSearch(e.target.value)}
            placeholder="Search FD number&hellip;"
            className="bg-[#17171a] border border-[#3a3a3f] rounded-full px-4 py-2 text-[13px] font-semibold text-[#ededed] placeholder:text-[#6e6e73] placeholder:font-normal focus:outline-none focus:border-[#ededed] focus:shadow-[0_0_0_1px_#ededed] transition-all w-full sm:w-48"
          />

          {(bankFilter !== "all" || filter !== "all" || fdSearch.trim()) && (
            <button
              onClick={() => { setFilter("all"); setBankFilter("all"); setFdSearch(""); }}
              className="text-[13px] text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors self-center"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile card list (hidden on sm+) ── */}
      <div className="sm:hidden ab-card overflow-hidden divide-y divide-[#2a2a2e]">
        {sorted.length === 0 && (
          <p className="p-6 text-center text-[14px] text-[#a0a0a5]">No FDs match the current filters.</p>
        )}
        {sorted.map((fd) => {
          const current = resolveCurrent(fd);
          const isMatured = current.maturityDate <= now;
          const displayMaturityValue = current.maturityAmount ?? current.principal;
          const isExpanded = expandedIds.has(fd.id);

          return (
            <Fragment key={fd.id}>
              <div
                onClick={() => toggleExpanded(fd.id)}
                className={cn(
                  "p-4 cursor-pointer transition-colors",
                  fd.disabled
                    ? "opacity-50 hover:opacity-70"
                    : isMatured
                    ? "bg-[#2a1f0d]"
                    : "hover:bg-[#1c1c20]",
                  isExpanded && !isMatured && "bg-[#17171a]"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="font-bold text-[10px] text-[#ff385c]">
                      {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#ededed] text-[14px] truncate">{fd.bankName}</span>
                      <StatusBadge fd={fd} current={current} now={now} />
                    </div>

                    {/* Principal → At Maturity */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="mono text-[13px] text-[#a0a0a5]">{formatINR(current.principal)}</span>
                      <span className="text-[#6e6e73] text-[12px]">&#x2192;</span>
                      <span className="mono text-[14px] font-bold text-[#ededed]">{formatINR(displayMaturityValue)}</span>
                    </div>

                    {/* Rate · Tenure · Maturity date */}
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#a0a0a5] flex-wrap">
                      <span className="mono">{current.interestRate}%</span>
                      <span className="text-[#6e6e73]">&middot;</span>
                      <span>{formatTenure(current)}</span>
                      <span className="text-[#6e6e73]">&middot;</span>
                      <span>{formatDate(current.maturityDate)}</span>
                      {fd.fdNumber && (
                        <>
                          <span className="text-[#6e6e73]">&middot;</span>
                          <span className="mono">{fd.fdNumber}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <ChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 text-[#6e6e73] mt-1 transition-transform duration-200",
                      isExpanded && "rotate-90"
                    )}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="bg-[#0e0e11] px-4 py-5">
                  <FDDetailContent fd={fd} />
                  <div className="flex items-center justify-between gap-4 flex-wrap pt-5 mt-5 border-t border-[#2a2a2e]">
                    <Link
                      href={`/dashboard/fd/${fd.id}`}
                      className="text-[12px] text-[#a0a0a5] hover:text-[#ededed] font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      Open full page <ArrowUpRight size={12} />
                    </Link>
                    <div className="flex items-center gap-2">
                      {!fd.disabled && (
                        <Link href={`/dashboard/fd/renew/${fd.id}`} className="ab-btn ab-btn-secondary">
                          <RefreshCw size={13} /> Renew
                        </Link>
                      )}
                      <FDDisableButton id={fd.id} disabled={fd.disabled} showDelete={fd.disabled} />
                    </div>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden sm:block ab-card overflow-hidden">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="bg-[#1c1c20]">
              {HEADERS.map((h, i) => {
                const isActive = h.sortCol !== undefined && sort?.col === h.sortCol;
                const SortIcon = isActive
                  ? sort!.dir === "asc" ? ChevronUp : ChevronDown
                  : ChevronsUpDown;
                return (
                  <th
                    key={i}
                    onClick={h.sortCol ? () => handleSort(h.sortCol!) : undefined}
                    onKeyDown={h.sortCol ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort(h.sortCol!); } } : undefined}
                    tabIndex={h.sortCol ? 0 : undefined}
                    aria-sort={h.sortCol ? (isActive ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                    className={cn(
                      "text-[11px] uppercase tracking-wider font-semibold px-4 py-3 select-none",
                      h.align === "right" ? "text-right" : h.align === "center" ? "text-center" : "text-left",
                      h.className,
                      h.sortCol && "cursor-pointer hover:text-[#ededed] transition-colors",
                      isActive ? "text-[#ededed]" : "text-[#a0a0a5]"
                    )}
                  >
                    {h.sortCol ? (
                      <span className="inline-flex items-center gap-1">
                        {h.align === "right" && <SortIcon size={11} />}
                        {h.label}
                        {h.align === "left" && <SortIcon size={11} />}
                      </span>
                    ) : (
                      h.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2e]">
            {sorted.map((fd) => {
              const current = resolveCurrent(fd);
              const isMatured = current.maturityDate <= now;
              const displayMaturityValue = current.maturityAmount ?? current.principal;
              const isExpanded = expandedIds.has(fd.id);

              return (
                <Fragment key={fd.id}>
                  <tr
                    onClick={() => toggleExpanded(fd.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      fd.disabled ? "opacity-50 hover:opacity-70 hover:bg-[#1c1c20]" :
                        isMatured ? "bg-[#2a1f0d] hover:bg-[#2a1f0d]" : "hover:bg-[#1c1c20]",
                      isExpanded && "bg-[#17171a]"
                    )}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
                          <span className="font-bold text-[10px] text-[#ff385c]">
                            {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-[#ededed] text-[13px]">{fd.bankName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-[#a0a0a5] mono">{fd.fdNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-right mono text-[#ededed] font-medium text-[13px]">{formatINR(current.principal)}</td>
                    <td className="px-4 py-2 text-right mono text-[#ededed] font-medium text-[13px]">{current.interestRate}%</td>
                    <td className="px-4 py-2 text-[13px] text-[#a0a0a5]">{formatTenure(current)}</td>
                    <td className="px-4 py-2 text-[#a0a0a5] text-[12px] whitespace-nowrap">
                      {formatDate(current.startDate)} <span className="text-[#6e6e73]">&#x2192;</span> {formatDate(current.maturityDate)}
                    </td>
                    <td className="px-4 py-2 text-right mono text-[#ededed] font-semibold text-[13px]">{formatINR(displayMaturityValue)}</td>
                    <td className="px-4 py-2"><StatusBadge fd={fd} current={current} now={now} /></td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(fd.id); }}
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#6e6e73] hover:text-[#ededed] hover:bg-[#1c1c20] transition-colors"
                      >
                        <ChevronRight
                          size={14}
                          className={cn("transition-transform duration-200", isExpanded && "rotate-90")}
                        />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[#0e0e11]">
                      <td colSpan={COL_COUNT} className="px-6 py-6">
                        <FDDetailContent fd={fd} />
                        <div className="flex items-center justify-between gap-4 flex-wrap pt-5 mt-5 border-t border-[#2a2a2e]">
                          <Link
                            href={`/dashboard/fd/${fd.id}`}
                            className="text-[12px] text-[#a0a0a5] hover:text-[#ededed] font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            Open full page <ArrowUpRight size={12} />
                          </Link>
                          <div className="flex items-center gap-2">
                            {!fd.disabled && (
                              <Link href={`/dashboard/fd/renew/${fd.id}`} className="ab-btn ab-btn-secondary">
                                <RefreshCw size={13} /> Renew
                              </Link>
                            )}
                            <FDDisableButton id={fd.id} disabled={fd.disabled} showDelete={fd.disabled} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
