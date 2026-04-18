"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Landmark, AlertTriangle, ArrowRight, Wallet, BarChart2, PiggyBank, Activity, type LucideIcon } from "lucide-react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { InterestAccrualChart } from "@/components/charts/interest-accrual-chart";
import { TopHoldingsChart } from "@/components/charts/top-holdings-chart";
import { formatINR, formatINRCompact, formatPercent, formatDate, daysUntil } from "@/lib/format";
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
}

function StatCard({
  label, value, sub, positive, Icon,
}: {
  label: string; value: string; sub?: string; positive?: boolean;
  accent?: "primary" | "secondary" | "tertiary" | "neutral";
  Icon?: LucideIcon;
}) {
  return (
    <div className="bg-[#1b1b1e] rounded-xl p-4 relative overflow-hidden ghost-border">
      <div className="relative z-10 flex flex-col h-full gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[#cbc4d0] text-[10px] uppercase tracking-widest font-label">{label}</p>
          {Icon && <Icon size={13} className="text-[#cbc4d0]/50 stroke-[1.5]" />}
        </div>
        <p className="mono text-2xl font-bold text-[#e4e1e6]">{value}</p>
        {sub && (
          <p className={cn("text-xs flex items-center gap-1",
            positive === true ? "text-primary" : positive === false ? "text-[#ffafd7]" : "text-[#cbc4d0]"
          )}>
            {positive === true && <TrendingUp size={11} />}
            {positive === false && <TrendingDown size={11} />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export function OverviewClient({ summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected }: Props) {
  const { equity, fd, mf } = summary;
  const hasEquity = holdings.length > 0;
  const hasMF = mfHoldings.length > 0;
  const hasFD = fd.totalPrincipal > 0;
  const hasAny = hasEquity || hasFD || hasMF;

  if (!hasAny) {
    return (
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-10 text-center max-w-md">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Landmark size={20} className="text-primary" />
        </div>
        <p className="font-headline font-bold text-lg text-[#e4e1e6]">No investments tracked yet</p>
        <p className="text-[#cbc4d0] text-sm mt-1 mb-5">Connect Zerodha or add a Fixed Deposit to get started.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard/settings" className="px-4 py-2 rounded-md bg-primary text-[#00382f] text-xs font-bold hover:bg-[#26fedc] transition-colors shadow-[0_0_15px_rgba(0,223,193,0.3)]">
            Connect Zerodha
          </Link>
          <Link href="/dashboard/fd/new" className="px-4 py-2 rounded-md bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
            Add FD
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Portfolio"
          value={formatINR(summary.totalValue)}
          sub={`Capital: ${formatINR(summary.totalCapital)}`}
          accent="primary"
          Icon={Wallet}
        />
        <StatCard
          label="Equity Value"
          value={hasEquity ? formatINR(equity.currentValue) : "—"}
          sub={hasEquity ? `${formatPercent(equity.totalPnLPct)} overall` : "Not connected"}
          positive={hasEquity ? equity.totalPnL >= 0 : undefined}
          accent="secondary"
          Icon={BarChart2}
        />
        <StatCard
          label="FD Corpus"
          value={hasFD ? formatINR(fd.totalMaturity) : "—"}
          sub={hasFD ? `${fd.weightedRate.toFixed(2)}% avg rate` : "No FDs added"}
          accent="tertiary"
          Icon={PiggyBank}
        />
        <StatCard
          label="Portfolio CAGR"
          value={summary.cagr !== 0 ? `${summary.cagr.toFixed(2)}%` : "—"}
          sub={summary.cagr !== 0 ? "annualised return" : "Add more data"}
          positive={summary.cagr > 0 ? true : summary.cagr < 0 ? false : undefined}
          accent="neutral"
          Icon={Activity}
        />
      </section>

      {/* Main layout: 8/4 split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: charts */}
        <div className="lg:col-span-8 space-y-4">

          {/* Asset Allocation */}
          <div className="bg-[#0e0e11] rounded-xl p-4 ghost-border">
            <h2 className="font-headline font-bold text-sm text-[#e4e1e6] mb-4">Asset Allocation</h2>
            <div className="flex items-center gap-6">
              <div className="shrink-0 w-[140px] h-[140px]">
                <AllocationDonut
                  equityValue={equity.currentValue}
                  fdValue={fd.totalMaturity}
                  mfValue={mf.currentValue}
                  centerLabel="Total"
                  centerValue={formatINRCompact(summary.totalValue)}
                />
              </div>
              <div className="flex-1 space-y-3">
                {[
                  { label: "Equity", sub: "Zerodha stocks", value: formatINR(equity.currentValue), pct: summary.equityPct, color: "#8b7fb0" },
                  { label: "Mutual Funds", sub: "Direct MF", value: formatINR(mf.currentValue), pct: summary.mfPct, color: "#6b8ca0" },
                  { label: "Fixed Deposits", sub: "FDs + SGBs", value: formatINR(fd.totalMaturity), pct: summary.fdPct, color: "#b08795" },
                ].filter((r) => r.pct > 0).map(({ label, sub, value, pct, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-1 h-9 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-headline font-semibold text-xs text-[#e4e1e6]">{label}</p>
                      <p className="text-[10px] text-[#cbc4d0] mt-0.5">{sub}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="mono font-semibold text-xs text-[#e4e1e6]">{pct.toFixed(1)}%</p>
                      <p className="mono text-[10px] text-[#cbc4d0] mt-0.5">{value}</p>
                    </div>
                    <div className="flex-1 min-w-[80px] max-w-[200px]">
                      <div className="h-1.5 rounded-full bg-[#2a2a2d] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MF Pulse */}
          {hasMF && (
            <div className="bg-[#1b1b1e] rounded-xl p-4 ghost-border">
              <h3 className="font-headline font-semibold text-sm text-[#e4e1e6] mb-3">Mutual Funds</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Invested", value: formatINR(mf.totalInvested), color: "text-[#e4e1e6]" },
                  { label: "Current Value", value: formatINR(mf.currentValue), color: "text-[#e4e1e6]" },
                  { label: "Total P&L", value: (mf.totalPnL >= 0 ? "+" : "") + formatINR(mf.totalPnL), color: mf.totalPnL >= 0 ? "text-primary" : "text-[#ffafd7]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="border-l border-[#49454e]/40 pl-3">
                    <p className="text-[10px] text-[#cbc4d0] uppercase tracking-wider font-label">{label}</p>
                    <p className={cn("mono text-lg font-semibold mt-0.5", color)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FD Interest Accrual */}
          {hasFD && (
            <div className="bg-[#1b1b1e] rounded-xl p-4 ghost-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-headline font-bold text-sm text-[#e4e1e6]">FD Interest Accrual</h3>
                <div className="flex items-center gap-4 text-[10px] text-[#cbc4d0]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-primary inline-block" /> Accrued</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-px border-t border-dashed border-primary/60 inline-block" /> Projected</span>
                </div>
              </div>
              <InterestAccrualChart data={timeline} />
            </div>
          )}

          {/* Top Holdings */}
          {hasEquity && (
            <div className="bg-[#1b1b1e] rounded-xl p-4 ghost-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-headline font-bold text-sm text-[#e4e1e6]">Top Holdings</h3>
                <Link href="/dashboard/zerodha" className="text-xs text-primary hover:text-[#26fedc] flex items-center gap-1 transition-colors">
                  View all <ArrowRight size={10} />
                </Link>
              </div>
              <TopHoldingsChart holdings={holdings} />
            </div>
          )}
        </div>

        {/* Right: upcoming maturities */}
        <div className="lg:col-span-4 space-y-4">
          {/* FD interest row */}
          {hasFD && (
            <div className="space-y-2">
              {[
                { label: "Interest This Year", value: formatINR(fd.interestThisYear), color: "text-[#e4e1e6]" },
                { label: "Total FD Interest", value: formatINR(fd.totalInterest), color: "text-[#e4e1e6]" },
                { label: "Equity P&L", value: (equity.totalPnL >= 0 ? "+" : "") + formatINR(equity.totalPnL), color: equity.totalPnL >= 0 ? "text-primary" : "text-[#ffafd7]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#1b1b1e] ghost-border rounded-xl p-3 flex items-center justify-between">
                  <p className="text-[10px] text-[#cbc4d0] uppercase tracking-wider">{label}</p>
                  <p className={cn("mono font-semibold text-sm", color)}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming maturities */}
          {hasFD && upcomingMaturities.length > 0 && (
            <div className="bg-[#0e0e11] rounded-xl p-4 ghost-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-headline font-bold text-sm text-[#e4e1e6]">Upcoming Maturities</h3>
                <Link href="/dashboard/fd" className="text-[10px] text-primary hover:text-[#26fedc] flex items-center gap-0.5 transition-colors">
                  View all <ArrowRight size={9} />
                </Link>
              </div>
              <div className="space-y-0 divide-y divide-[rgba(73,69,78,0.15)]">
                {upcomingMaturities.map((fd) => {
                  const days = daysUntil(fd.maturityDate);
                  return (
                    <div key={fd.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-headline font-bold text-sm text-[#e4e1e6]">{fd.bankName}</p>
                        <p className="text-xs text-[#cbc4d0] mt-0.5">{formatDate(fd.maturityDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="mono text-sm font-bold text-[#e4e1e6]">{formatINR(fd.maturityAmount ?? fd.principal)}</p>
                        <p className={cn("text-[10px] font-medium flex items-center gap-0.5 justify-end mt-0.5",
                          days <= 7 ? "text-[#ffafd7]" : days <= 30 ? "text-amber-400" : "text-[#cbc4d0]"
                        )}>
                          {days <= 30 && <AlertTriangle size={9} />}
                          {days}d remaining
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasEquity && !kiteConnected && (
            <div className="bg-[#1b1b1e] ghost-border rounded-xl p-6 flex flex-col items-center gap-3 text-center">
              <TrendingUp size={20} className="text-[#cbc4d0]" />
              <div>
                <p className="font-headline font-bold text-sm text-[#e4e1e6]">Connect Zerodha</p>
                <p className="text-xs text-[#cbc4d0] mt-0.5">Link your Kite account to see equity holdings.</p>
              </div>
              <Link href="/dashboard/settings" className="px-4 py-2 rounded-md bg-primary text-[#00382f] text-xs font-bold hover:bg-[#26fedc] transition-colors shadow-[0_0_12px_rgba(0,223,193,0.25)]">
                Go to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
