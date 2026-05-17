"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Landmark, AlertTriangle, ArrowRight, Wallet, BarChart2, PiggyBank, Coins, Printer, Loader2, LineChart, type LucideIcon } from "lucide-react";
import { BankBalanceStrip, type BankBalance } from "@/components/bank-accounts/bank-balance-strip";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { TopHoldingsChart } from "@/components/charts/top-holdings-chart";
import { WealthProjectionChart } from "@/components/charts/wealth-projection-chart";
import { formatINR, formatINRCompact, formatPercent, formatDate, daysUntil } from "@/lib/format";
import { buildPdfData } from "@/lib/pdf-data";
import { generateOverviewPdf } from "@/lib/generate-overview-pdf";
import { cn } from "@/lib/utils";
import type { Holding, MFHolding, FDRecord } from "@/lib/analytics";

interface Props {
  summary: {
    totalCapital: number;
    totalValue: number;
    cagr: number;
    equityPct: number;
    fdPct: number;
    mfPct: number;
    equity: { totalInvested: number; currentValue: number; totalPnL: number; totalPnLPct: number };
    fd: { totalPrincipal: number; totalMaturity: number; totalInterest: number; interestThisYear: number; weightedRate: number };
    mf: { totalInvested: number; currentValue: number; totalPnL: number; totalPnLPct: number };
  };
  timeline: { month: string; accrued: number; projected: number }[];
  holdings: Holding[];
  mfHoldings: MFHolding[];
  upcomingMaturities: FDRecord[];
  kiteConnected: boolean;
  goldTotals: {
    count: number;
    currentValue: number;
    invested: number;
    gainLoss: number | null;
    hasRate: boolean;
  };
  fdsByBank: { bankName: string; total: number }[];
  bankBalances: BankBalance[];
  njTotals: {
    invested: number;
    currentValue: number;
    gainLoss: number;
    xirrPct: number | null;
    schemeCount: number;
    reportDate: string;
  } | null;
  userEmail: string;
}

function StatCard({
  label, value, sub, positive, Icon,
}: {
  label: string; value: string; sub?: string; positive?: boolean;
  Icon?: LucideIcon;
}) {
  return (
    <div className="ab-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{label}</p>
        {Icon && (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--surface-muted)] text-[var(--text-primary)]">
            <Icon size={15} strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mono text-[15px] sm:text-[22px] font-bold text-[var(--text-primary)] leading-tight">{value}</p>
      {sub && (
        <p className={cn(
          "text-[11px] sm:text-[12px] flex items-center gap-1 mt-1.5 font-medium truncate",
          positive === true ? "text-[var(--accent-success)]" : positive === false ? "text-[var(--accent-error)]" : "text-[var(--text-secondary)]"
        )}>
          {positive === true && <TrendingUp size={12} />}
          {positive === false && <TrendingDown size={12} />}
          <span className="truncate">{sub}</span>
        </p>
      )}
    </div>
  );
}

export function OverviewClient({ summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected, goldTotals, fdsByBank, bankBalances, njTotals, userEmail }: Props) {
  const [printing, setPrinting] = useState(false);
  const { equity, fd, mf } = summary;
  const hasEquity = holdings.length > 0;
  const hasMF = mfHoldings.length > 0;
  const hasFD = fd.totalPrincipal > 0;
  const hasGold = goldTotals.count > 0;
  const hasNJ = !!njTotals && njTotals.schemeCount > 0;
  const hasAny = hasEquity || hasFD || hasMF || hasGold || hasNJ;

  const njValue = njTotals?.currentValue ?? 0;
  const njInvested = njTotals?.invested ?? 0;
  const njPnL = njTotals?.gainLoss ?? 0;

  const hasMFAny = hasMF || hasNJ;
  const totalMFValue = mf.currentValue + njValue;
  const totalMFInvested = mf.totalInvested + njInvested;
  const totalMFPnL = mf.totalPnL + njPnL;
  const totalMFPnLPct = totalMFInvested > 0 ? (totalMFPnL / totalMFInvested) * 100 : 0;

  const allocationTotal = summary.totalValue + goldTotals.currentValue + njValue;
  const allocationPct = (v: number) => (allocationTotal > 0 ? (v / allocationTotal) * 100 : 0);

  async function handlePrint() {
    setPrinting(true);
    try {
      const data = buildPdfData(
        { summary, timeline, holdings, mfHoldings, goldTotals, upcomingMaturities, fdsByBank, bankBalances, njTotals },
        userEmail,
      );
      await generateOverviewPdf(data);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setPrinting(false);
    }
  }

  if (!hasAny) {
    return (
      <div className="ab-card p-10 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-[var(--primary-tint)] flex items-center justify-center mx-auto mb-5">
          <Landmark size={22} className="text-[var(--primary)]" />
        </div>
        <p className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">No investments tracked yet</p>
        <p className="text-[14px] text-[var(--text-secondary)] mt-2 mb-6">Connect Zerodha or add a Fixed Deposit to get started.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/dashboard/settings" className="ab-btn ab-btn-accent">
            Connect Zerodha
          </Link>
          <Link href="/dashboard/fd/new" className="ab-btn ab-btn-secondary">
            Add FD
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">Overview</h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">Your complete investment portfolio at a glance.</p>
        </div>
        <button
          onClick={handlePrint}
          disabled={printing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] text-[13px] font-medium hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mt-1"
        >
          {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          {printing ? "Generating…" : "Print PDF"}
        </button>
      </div>

      {/* ── Hero: Total Portfolio ── */}
      <div className="ab-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            {/* Desktop-only large icon */}
            <span className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface-muted)] text-[var(--text-primary)] shrink-0 mt-0.5">
              <Wallet size={18} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              {/* Label row: icon (mobile) + label + CAGR pill (mobile only) */}
              <div className="flex items-center justify-between gap-2 mb-1 sm:mb-0">
                <div className="flex items-center gap-2">
                  <span className="sm:hidden inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--surface-muted)] text-[var(--text-primary)] shrink-0">
                    <Wallet size={12} strokeWidth={2} />
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Total Portfolio</p>
                </div>
                {summary.cagr !== 0 && (
                  <div className={cn(
                    "sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shrink-0",
                    summary.cagr > 0 ? "bg-[var(--gain-bg)] border-[var(--gain-border)]" : "bg-[var(--loss-bg)] border-[var(--loss-border)]"
                  )}>
                    <p className={cn("mono text-[13px] font-bold leading-none", summary.cagr > 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]")}>
                      {summary.cagr.toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">CAGR</p>
                  </div>
                )}
              </div>
              <p className="mono text-[26px] sm:text-[36px] font-bold text-[var(--text-primary)] leading-tight sm:mt-0.5">
                {formatINR(summary.totalValue + njValue)}
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1.5">
                Capital invested:{" "}
                <span className="text-[var(--text-primary)] font-medium">{formatINR(summary.totalCapital + njInvested)}</span>
              </p>
            </div>
          </div>
          {/* Desktop-only large CAGR badge */}
          {summary.cagr !== 0 && (
            <div className={cn(
              "hidden sm:flex self-center shrink-0 flex-col items-center px-5 py-3 rounded-xl border",
              summary.cagr > 0 ? "bg-[var(--gain-bg)] border-[var(--gain-border)]" : "bg-[var(--loss-bg)] border-[var(--loss-border)]"
            )}>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-secondary)] mb-0.5">CAGR</p>
              <p className={cn(
                "mono text-[24px] font-bold leading-tight",
                summary.cagr > 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"
              )}>
                {summary.cagr.toFixed(2)}%
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">annualised</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sub-metric cards ── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Equity"
          value={hasEquity ? formatINR(equity.currentValue) : "—"}
          sub={hasEquity ? `${formatPercent(equity.totalPnLPct)} overall` : "Not connected"}
          positive={hasEquity ? equity.totalPnL >= 0 : undefined}
          Icon={BarChart2}
        />
        <StatCard
          label="Fixed Deposits"
          value={hasFD ? formatINR(fd.totalPrincipal) : "—"}
          sub={hasFD ? `→ ${formatINR(fd.totalMaturity)} @ ${fd.weightedRate.toFixed(2)}%` : "No FDs added"}
          Icon={PiggyBank}
        />
        <Link href="/dashboard/equity-mf" className="block hover:brightness-110 transition h-full">
          <StatCard
            label="Mutual Funds"
            value={hasMFAny ? formatINR(totalMFValue) : "—"}
            sub={hasMFAny ? `${formatPercent(totalMFPnLPct)} overall` : "No funds linked"}
            positive={hasMFAny ? totalMFPnL >= 0 : undefined}
            Icon={LineChart}
          />
        </Link>
        <Link href="/dashboard/gold" className="block hover:brightness-110 transition h-full">
          <StatCard
            label="Gold"
            value={hasGold && goldTotals.hasRate ? formatINR(goldTotals.currentValue) : "—"}
            sub={hasGold
              ? (goldTotals.gainLoss != null
                ? `${goldTotals.count} items · ${goldTotals.gainLoss >= 0 ? "+" : ""}${formatINR(goldTotals.gainLoss)}`
                : `${goldTotals.count} items`)
              : "No jewellery added"}
            positive={goldTotals.gainLoss != null ? goldTotals.gainLoss >= 0 : undefined}
            Icon={Coins}
          />
        </Link>
      </section>

      {bankBalances.length > 0 && <BankBalanceStrip balances={bankBalances} />}

      {/* ── Asset Allocation — full width ── */}
      <div className="ab-card p-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5 tracking-tight">Asset Allocation</h2>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="shrink-0 w-[168px] h-[168px]">
            <AllocationDonut
              equityValue={equity.currentValue}
              fdValue={fd.totalMaturity}
              mfValue={mf.currentValue + njValue}
              goldValue={goldTotals.currentValue}
              centerLabel="Total"
              centerValue={formatINRCompact(allocationTotal)}
            />
          </div>
          <div className="flex-1 min-w-[260px] space-y-4">
            {[
              { label: "Equity", sub: "Zerodha stocks", value: formatINR(equity.currentValue), pct: allocationPct(equity.currentValue), color: "var(--primary)" },
              { label: "MF — Zerodha", sub: "Direct MF", value: formatINR(mf.currentValue), pct: allocationPct(mf.currentValue), color: "var(--accent-info)" },
              { label: "MF — NJ India", sub: "Statement-based", value: formatINR(njValue), pct: allocationPct(njValue), color: "#8b5cf6" },
              { label: "Fixed Deposits", sub: "FDs + SGBs", value: formatINR(fd.totalMaturity), pct: allocationPct(fd.totalMaturity), color: "var(--accent-success)" },
              { label: "Gold", sub: "Jewellery (IBJA rate)", value: formatINR(goldTotals.currentValue), pct: allocationPct(goldTotals.currentValue), color: "var(--accent-warning)" },
            ].filter((r) => r.pct > 0).map(({ label, sub, value, pct, color }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--text-primary)]">{label}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{sub}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="mono text-[14px] font-semibold text-[var(--text-primary)]">{pct.toFixed(1)}%</p>
                    <p className="mono text-[12px] text-[var(--text-secondary)]">{value}</p>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-[var(--surface-subtle)] overflow-hidden ml-5">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left: Investment summaries */}
        <div className="space-y-5">
          {hasEquity && (
            <div className="ab-card p-6">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4 tracking-tight">Equity</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Invested", value: formatINR(equity.totalInvested), cls: "text-[var(--text-primary)]" },
                  { label: "Current Value", value: formatINR(equity.currentValue), cls: "text-[var(--text-primary)]" },
                  { label: "Total P&L", value: (equity.totalPnL >= 0 ? "+" : "") + formatINR(equity.totalPnL), cls: equity.totalPnL >= 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]" },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{label}</p>
                    <p className={cn("mono text-[15px] font-semibold mt-1 break-all", cls)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasMF && (
            <div className="ab-card p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Mutual Funds — Zerodha</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-inset ring-[var(--primary)]/20">Zerodha</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Invested", value: formatINR(mf.totalInvested), cls: "text-[var(--text-primary)]" },
                  { label: "Current Value", value: formatINR(mf.currentValue), cls: "text-[var(--text-primary)]" },
                  { label: "Total P&L", value: (mf.totalPnL >= 0 ? "+" : "") + formatINR(mf.totalPnL), cls: mf.totalPnL >= 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]" },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{label}</p>
                    <p className={cn("mono text-[15px] font-semibold mt-1 break-all", cls)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasNJ && njTotals && (
            <div className="ab-card p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Mutual Funds — NJ India</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] ring-1 ring-inset ring-[#8b5cf6]/20">NJ India</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Invested", value: formatINR(njInvested), cls: "text-[var(--text-primary)]" },
                  { label: "Current Value", value: formatINR(njValue), cls: "text-[var(--text-primary)]" },
                  { label: "Total P&L", value: (njPnL >= 0 ? "+" : "") + formatINR(njPnL), cls: njPnL >= 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]" },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{label}</p>
                    <p className={cn("mono text-[15px] font-semibold mt-1 break-all", cls)}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-[var(--border)] flex items-center justify-between gap-4">
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">XIRR</p>
                    <p className="mono text-[15px] font-semibold text-[var(--text-primary)] mt-1">
                      {njTotals.xirrPct != null ? `${njTotals.xirrPct.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Schemes</p>
                    <p className="mono text-[15px] font-semibold text-[var(--text-primary)] mt-1">{njTotals.schemeCount}</p>
                  </div>
                </div>
                <Link href="/dashboard/equity-mf/nj-india" className="text-[12px] text-[var(--text-secondary)] font-semibold hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors shrink-0">
                  Manage uploads <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          )}

          {!hasEquity && !kiteConnected && (
            <div className="ab-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--primary-tint)] flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} className="text-[var(--primary)]" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Connect Zerodha</p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1 mb-4">Link your Kite account to see equity holdings.</p>
              <Link href="/dashboard/settings" className="ab-btn ab-btn-accent inline-flex">
                Go to Settings
              </Link>
            </div>
          )}
        </div>

        {/* Right: FD stats + Maturities + Wealth Projection */}
        <div className="space-y-5">
          {hasFD && (
            <div className="space-y-3">
              {[
                { label: "Interest This Year", value: formatINR(fd.interestThisYear) },
                { label: "Total FD Interest", value: formatINR(fd.totalInterest) },
              ].map(({ label, value }) => (
                <div key={label} className="ab-card-flat p-4 flex items-center justify-between">
                  <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{label}</p>
                  <p className="mono font-semibold text-[15px] text-[var(--text-primary)]">{value}</p>
                </div>
              ))}
            </div>
          )}

          {hasFD && upcomingMaturities.length > 0 && (
            <div className="ab-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">Upcoming Maturities</h3>
                <Link href="/dashboard/fd" className="text-[12px] text-[var(--text-primary)] font-semibold underline underline-offset-4 flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {upcomingMaturities.map((fd) => {
                  const days = daysUntil(fd.maturityDate);
                  return (
                    <div key={fd.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--text-primary)]">{fd.bankName}</p>
                        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{formatDate(fd.maturityDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="mono text-[14px] font-semibold text-[var(--text-primary)]">{formatINR(fd.maturityAmount ?? fd.principal)}</p>
                        <p className={cn(
                          "text-[11px] font-semibold flex items-center gap-0.5 justify-end mt-0.5",
                          days <= 7 ? "text-[var(--accent-error)]" : days <= 30 ? "text-[var(--accent-warning)]" : "text-[var(--text-secondary)]"
                        )}>
                          {days <= 30 && <AlertTriangle size={10} />}
                          {days}d remaining
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {summary.cagr > 0 && (
            <div className="ab-card p-6">
              <h3 className="text-[18px] font-semibold text-[var(--text-primary)] mb-4 tracking-tight">Wealth Projection</h3>
              <WealthProjectionChart currentValue={summary.totalValue} cagr={summary.cagr} />
            </div>
          )}
        </div>
      </div>

      {/* ── Top Holdings — full width ── */}
      {hasEquity && (
        <div className="ab-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight">Top Holdings</h3>
            <Link href="/dashboard/equity-mf/zerodha" className="text-[13px] text-[var(--text-primary)] font-semibold underline underline-offset-4 flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <TopHoldingsChart holdings={holdings} />
        </div>
      )}
    </div>
  );
}
