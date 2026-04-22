"use client";

import Link from "next/link";
import { useState, Fragment } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { FDDetailContent, type FDDetailData } from "./fd-detail-content";
import { FDDisableButton } from "./fd-disable-button";

type FD = FDDetailData & { disabled: boolean };

type Filter = "all" | "active" | "matured" | "disabled";
type SortCol = "principal" | "rate" | "tenure" | "atMaturity";
type SortDir = "asc" | "desc";
type HeaderDef =
  | { label: string; sortCol?: undefined; align: "left" | "right" | "center"; className?: string }
  | { label: string; sortCol: SortCol; align: "left" | "right" | "center"; className?: string };

export function FDList({ fds }: { fds: FD[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
  const now = new Date();

  function normalizeBankName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
  }

  // Group variations by normalized name; pick the first-seen variant as canonical display name.
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

  function resolveCurrent(fd: FD) {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      startDate: new Date(latest?.startDate ?? fd.startDate),
      maturityDate: new Date(latest?.maturityDate ?? fd.maturityDate),
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
    };
  }

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
    return true;
  });

  const sorted = sort === null ? filtered : (() => {
    const key = (fd: FD): number => {
      const c = resolveCurrent(fd);
      switch (sort.col) {
        case "principal":  return c.principal;
        case "rate":       return c.interestRate;
        case "tenure":     return c.tenureMonths;
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

  const HEADERS: HeaderDef[] = [
    { label: "Bank",        align: "left" },
    { label: "FD No.",      align: "left" },
    { label: "Principal",   align: "right", sortCol: "principal" },
    { label: "Rate",        align: "right", sortCol: "rate" },
    { label: "Tenure",      align: "left",  sortCol: "tenure" },
    { label: "Duration",    align: "left" },
    { label: "At Maturity", align: "right", sortCol: "atMaturity" },
    { label: "Status",      align: "left" },
    { label: "",            align: "center", className: "w-[44px]" },
  ];
  const COL_COUNT = HEADERS.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 bg-[#1c1c20] rounded-full w-fit">
          {(["all", "active", "matured", "disabled"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all capitalize",
                filter === f
                  ? "bg-[#17171a] text-[#ededed] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#a0a0a5] hover:text-[#ededed]"
              )}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          className="bg-[#17171a] border border-[#3a3a3f] rounded-full px-4 py-2 text-[13px] font-semibold text-[#ededed] focus:outline-none focus:border-[#ededed] focus:shadow-[0_0_0_1px_#ededed] cursor-pointer transition-all"
        >
          <option value="all">All banks ({fds.length})</option>
          {banks.map(({ key, label, count }) => (
            <option key={key} value={key}>
              {label} ({count})
            </option>
          ))}
        </select>

        {(bankFilter !== "all" || filter !== "all") && (
          <button
            onClick={() => { setFilter("all"); setBankFilter("all"); }}
            className="text-[13px] text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
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
                      className={cn(
                        "text-[11px] uppercase tracking-wider font-semibold px-4 py-3 select-none",
                        h.align === "right" ? "text-right" : h.align === "center" ? "text-center" : "text-left",
                        h.className,
                        h.sortCol ? "cursor-pointer hover:text-[#ededed] transition-colors" : "",
                        isActive ? "text-[#ededed]" : "text-[#a0a0a5]"
                      )}
                    >
                      {h.sortCol ? (
                        <span className="inline-flex items-center gap-1">
                          {h.align === "right" && (
                            <SortIcon size={11} className={isActive ? "text-[#ededed]" : "text-[#6e6e73]"} />
                          )}
                          {h.label}
                          {h.align === "left" && (
                            <SortIcon size={11} className={isActive ? "text-[#ededed]" : "text-[#6e6e73]"} />
                          )}
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
                const days = daysUntil(current.maturityDate);
                const displayMaturityValue = current.maturityAmount ?? current.principal;
                const maturedDaysAgo = isMatured ? Math.floor((now.getTime() - current.maturityDate.getTime()) / 86400000) : 0;
                const isExpanded = expandedIds.has(fd.id);

                const statusBadge = fd.disabled ? (
                  <span className="ab-chip">Disabled</span>
                ) : isMatured ? (
                  <span className="inline-flex items-center gap-1 ab-chip ab-chip-warning">
                    <CheckCircle2 size={10} />
                    {maturedDaysAgo === 0 ? "Matured today" : `Matured ${maturedDaysAgo}d ago`}
                  </span>
                ) : days <= 7 ? (
                  <span className="inline-flex items-center gap-1 ab-chip ab-chip-error">
                    <AlertTriangle size={10} />{days}d left
                  </span>
                ) : days <= 30 ? (
                  <span className="ab-chip ab-chip-warning">{days}d left</span>
                ) : (
                  <span className="ab-chip ab-chip-success">{days}d left</span>
                );

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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
                            <span className="font-bold text-[11px] text-[#ff385c]">
                              {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                          </div>
                          <span className="font-semibold text-[#ededed] text-[14px]">{fd.bankName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#a0a0a5] mono">{fd.fdNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed] font-medium">{formatINR(current.principal)}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed] font-medium">{current.interestRate}%</td>
                      <td className="px-4 py-3 text-[#a0a0a5]">{current.tenureMonths}m</td>
                      <td className="px-4 py-3 text-[#a0a0a5] text-[13px] whitespace-nowrap">
                        {formatDate(current.startDate)} <span className="text-[#6e6e73]">→</span> {formatDate(current.maturityDate)}
                      </td>
                      <td className="px-4 py-3 text-right mono text-[#ededed] font-semibold">{formatINR(displayMaturityValue)}</td>
                      <td className="px-4 py-3">{statusBadge}</td>
                      <td className="px-4 py-3 text-center">
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
                                <Link
                                  href={`/dashboard/fd/renew/${fd.id}`}
                                  className="ab-btn ab-btn-secondary"
                                >
                                  <RefreshCw size={13} /> Renew
                                </Link>
                              )}
                              <FDDisableButton id={fd.id} disabled={fd.disabled} />
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
    </div>
  );
}
