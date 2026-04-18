"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatINR, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Holding {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
}

interface Position {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  product: string;
}

interface MFHolding {
  tradingsymbol: string;
  fund: string;
  folio: string | null;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  last_price_date: string | null;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  holdings: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  positions: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mfHoldings: any[];
}

function InlineStatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string;
  accent: "primary" | "secondary" | "tertiary" | "neutral";
}) {
  const valueColor = {
    primary: "text-primary",
    secondary: "text-[#e4e1e6]",
    tertiary: "text-[#ffafd7]",
    neutral: "text-[#e4e1e6]",
  }[accent];

  return (
    <div className="bg-[#1b1b1e] ghost-border rounded-xl p-3.5">
      <p className="text-[#cbc4d0] text-[10px] uppercase tracking-widest font-label mb-1">{label}</p>
      <p className={cn("mono text-xl font-semibold", valueColor)}>{value}</p>
      {sub && <p className="text-[#cbc4d0] text-xs mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, count, accent }: { title: string; count?: number; accent: "primary" | "secondary" | "tertiary" }) {
  const barColor = {
    primary: "bg-primary",
    secondary: "bg-[#d2bcfa]",
    tertiary: "bg-[#ffafd7]",
  }[accent];

  const textColor = {
    primary: "text-primary",
    secondary: "text-[#d2bcfa]",
    tertiary: "text-[#ffafd7]",
  }[accent];

  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-1 h-5 rounded-full", barColor)} />
      <h2 className="font-headline font-bold text-base text-[#e4e1e6]">{title}</h2>
      {count !== undefined && (
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full bg-current/10", textColor)}>
          {count}
        </span>
      )}
    </div>
  );
}

function SymbolAvatar({ symbol }: { symbol: string }) {
  const initials = symbol.replace(/[^A-Z]/g, "").slice(0, 2) || symbol.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-lg bg-[#d2bcfa]/10 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold font-headline text-[#d2bcfa]">{initials}</span>
    </div>
  );
}

export function ZerodhaDashboard({ holdings: rawHoldings, positions: rawPositions, mfHoldings: rawMFHoldings }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Holding>("pnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const holdings: Holding[] = rawHoldings ?? [];
  const netPositions: Position[] = rawPositions?.net?.filter((p: Position) => p.quantity !== 0) ?? [];
  const mfHoldings: MFHolding[] = rawMFHoldings ?? [];

  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0);
  const currentValue = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0);
  const totalPnL = currentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const dayPnL = holdings.reduce((s, h) => s + (h.day_change ?? 0) * h.quantity, 0);

  function toggleSort(key: keyof Holding) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = useMemo(() =>
    holdings
      .filter((h) => h.tradingsymbol.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortKey] as number;
        const bv = b[sortKey] as number;
        return sortDir === "asc" ? av - bv : bv - av;
      }),
    [holdings, search, sortKey, sortDir]
  );

  const thBase = "px-4 py-3 text-[10px] text-[#cbc4d0] uppercase tracking-widest font-headline cursor-pointer hover:text-[#e4e1e6] transition-colors select-none";
  const thL = cn(thBase, "text-left");
  const thR = cn(thBase, "text-right");

  return (
    <div className="space-y-5">
      {/* Equity summary */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InlineStatCard label="Total Invested" value={formatINR(totalInvested)} accent="neutral" />
        <InlineStatCard label="Current Value" value={formatINR(currentValue)} accent="secondary" />
        <InlineStatCard
          label="Overall P&L"
          value={formatINR(totalPnL)}
          sub={formatPercent(totalPnLPct)}
          accent={totalPnL >= 0 ? "primary" : "tertiary"}
        />
        <InlineStatCard
          label="Day's Change"
          value={formatINR(dayPnL)}
          accent={dayPnL >= 0 ? "primary" : "tertiary"}
        />
      </section>

      {/* Holdings table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader title="Equity Holdings" count={holdings.length} accent="secondary" />
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#cbc4d0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol…"
              className="pl-7 pr-3 py-1.5 text-xs bg-[#1b1b1e] ghost-border rounded-lg text-[#e4e1e6] placeholder:text-[#cbc4d0] focus:outline-none focus:ring-1 focus:ring-primary/40 w-40"
            />
          </div>
        </div>

        <div className="bg-[#0e0e11] ghost-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(73,69,78,0.15)]">
                <th className={thL}>Symbol</th>
                <th className={thR} onClick={() => toggleSort("quantity")}>Qty</th>
                <th className={thR} onClick={() => toggleSort("average_price")}>Avg Cost</th>
                <th className={thR} onClick={() => toggleSort("last_price")}>LTP</th>
                <th className={thR}>Value</th>
                <th className={thR} onClick={() => toggleSort("pnl")}>P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(73,69,78,0.08)]">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#cbc4d0] text-xs">No holdings found.</td></tr>
              )}
              {filtered.map((h) => {
                const gain = h.pnl >= 0;
                const pnlPct = h.average_price > 0 ? (h.pnl / (h.average_price * h.quantity)) * 100 : 0;
                return (
                  <tr key={h.tradingsymbol} className="hover:bg-[#1b1b1e]/60 transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <SymbolAvatar symbol={h.tradingsymbol} />
                        <div>
                          <span className="font-headline font-bold text-sm text-[#e4e1e6]">{h.tradingsymbol}</span>
                          <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-[#2a2a2d] text-[#cbc4d0] font-mono">{h.exchange}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right mono text-sm text-[#cbc4d0]">{h.quantity}</td>
                    <td className="px-3 py-2 text-right mono text-sm text-[#cbc4d0]">{formatINR(h.average_price)}</td>
                    <td className="px-3 py-2 text-right mono text-sm text-[#e4e1e6]">{formatINR(h.last_price)}</td>
                    <td className="px-3 py-2 text-right mono text-sm text-[#e4e1e6]">{formatINR(h.last_price * h.quantity)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("inline-flex items-center gap-0.5 mono text-sm font-bold", gain ? "text-primary" : "text-[#ffafd7]")}>
                        {gain ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {formatINR(Math.abs(h.pnl))}
                        <span className="text-[10px] opacity-70">({formatPercent(pnlPct)})</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Open Positions */}
      {netPositions.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Open Positions" count={netPositions.length} accent="tertiary" />
          <div className="bg-[#0e0e11] ghost-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(73,69,78,0.15)]">
                  <th className={thL}>Symbol</th>
                  <th className={thR}>Product</th>
                  <th className={thR}>Qty</th>
                  <th className={thR}>Avg</th>
                  <th className={thR}>Unrealised P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(73,69,78,0.08)]">
                {netPositions.map((p) => (
                  <tr key={`${p.tradingsymbol}-${p.product}`} className="hover:bg-[#1b1b1e]/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <SymbolAvatar symbol={p.tradingsymbol} />
                        <div>
                          <span className="font-headline font-bold text-sm text-[#e4e1e6]">{p.tradingsymbol}</span>
                          <span className="ml-2 text-[9px] text-[#cbc4d0]">{p.exchange}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-[#2a2a2d] text-[#cbc4d0]">{p.product}</span>
                    </td>
                    <td className="px-4 py-3 text-right mono text-[#e4e1e6]">{p.quantity}</td>
                    <td className="px-4 py-3 text-right mono text-[#e4e1e6]">{formatINR(p.average_price)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("mono font-bold", p.pnl >= 0 ? "text-primary" : "text-[#ffafd7]")}>
                        {p.pnl >= 0 ? "+" : ""}{formatINR(p.pnl)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Mutual Funds */}
      {mfHoldings.length > 0 && (() => {
        const mfInvested = mfHoldings.reduce((s, h) => s + h.average_price * h.quantity, 0);
        const mfValue = mfHoldings.reduce((s, h) => s + h.last_price * h.quantity, 0);
        const mfPnL = mfValue - mfInvested;
        const mfPnLPct = mfInvested > 0 ? (mfPnL / mfInvested) * 100 : 0;
        return (
          <section className="space-y-3">
            <SectionHeader title="Mutual Funds" count={mfHoldings.length} accent="primary" />
            <div className="grid grid-cols-3 gap-4">
              <InlineStatCard label="MF Invested" value={formatINR(mfInvested)} accent="neutral" />
              <InlineStatCard label="Current Value" value={formatINR(mfValue)} accent="primary" />
              <InlineStatCard label="Total P&L" value={formatINR(mfPnL)} sub={formatPercent(mfPnLPct)} accent={mfPnL >= 0 ? "primary" : "tertiary"} />
            </div>
            <div className="bg-[#0e0e11] ghost-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(73,69,78,0.15)]">
                    <th className={thL}>Fund</th>
                    <th className={thR}>Units</th>
                    <th className={thR}>Avg NAV</th>
                    <th className={thR}>Current NAV</th>
                    <th className={thR}>Value</th>
                    <th className={thR}>P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(73,69,78,0.08)]">
                  {mfHoldings.map((h) => {
                    const invested = h.average_price * h.quantity;
                    const pnl = h.last_price * h.quantity - invested;
                    const gain = pnl >= 0;
                    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                    const initials = (h.fund as string).split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                    return (
                      <tr key={`${h.tradingsymbol}-${h.folio ?? ""}`} className="hover:bg-[#1b1b1e]/60 transition-colors">
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold font-headline text-primary">{initials}</span>
                            </div>
                            <div>
                              <p className="font-headline font-bold text-sm text-[#e4e1e6] truncate max-w-[200px]">{h.fund}</p>
                              {h.folio && <p className="text-[10px] text-[#cbc4d0] mono mt-0.5">{h.folio}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right mono text-sm text-[#cbc4d0]">{h.quantity.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right mono text-sm text-[#cbc4d0]">{formatINR(h.average_price)}</td>
                        <td className="px-3 py-2 text-right mono text-sm text-[#e4e1e6]">{formatINR(h.last_price)}</td>
                        <td className="px-3 py-2 text-right mono text-sm text-[#e4e1e6]">{formatINR(h.last_price * h.quantity)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn("inline-flex items-center gap-0.5 mono text-sm font-bold", gain ? "text-primary" : "text-[#ffafd7]")}>
                            {gain ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            {formatINR(Math.abs(pnl))}
                            <span className="text-[10px] opacity-70">({formatPercent(pnlPct)})</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
