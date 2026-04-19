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
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueColor = tone === "positive" ? "text-[#5ee0a4]" : tone === "negative" ? "text-[#ff7a6e]" : "text-[#ededed]";
  return (
    <div className="ab-card p-4">
      <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className={cn("mono text-[20px] font-semibold", valueColor)}>{value}</p>
      {sub && <p className="text-[#a0a0a5] text-[12px] mt-1 font-medium">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[18px] font-semibold text-[#ededed] tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="ab-chip">{count}</span>
      )}
    </div>
  );
}

function SymbolAvatar({ symbol }: { symbol: string }) {
  const initials = symbol.replace(/[^A-Z]/g, "").slice(0, 2) || symbol.slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-[#222226] flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-[#ededed]">{initials}</span>
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

  const thBase = "px-4 py-3 text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold cursor-pointer hover:text-[#ededed] transition-colors select-none";
  const thL = cn(thBase, "text-left");
  const thR = cn(thBase, "text-right");

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InlineStatCard label="Total Invested" value={formatINR(totalInvested)} />
        <InlineStatCard label="Current Value" value={formatINR(currentValue)} />
        <InlineStatCard
          label="Overall P&L"
          value={formatINR(totalPnL)}
          sub={formatPercent(totalPnLPct)}
          tone={totalPnL >= 0 ? "positive" : "negative"}
        />
        <InlineStatCard
          label="Day's Change"
          value={formatINR(dayPnL)}
          tone={dayPnL >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader title="Equity Holdings" count={holdings.length} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0a5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol…"
              className="pl-9 pr-3 py-2 text-[13px] bg-[#17171a] border border-[#3a3a3f] rounded-full text-[#ededed] placeholder:text-[#6e6e73] focus:outline-none focus:border-[#ededed] focus:shadow-[0_0_0_1px_#ededed] w-48 transition-all"
            />
          </div>
        </div>

        <div className="ab-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="bg-[#1c1c20]">
                <tr>
                  <th className={thL}>Symbol</th>
                  <th className={thR} onClick={() => toggleSort("quantity")}>Qty</th>
                  <th className={thR} onClick={() => toggleSort("average_price")}>Avg Cost</th>
                  <th className={thR} onClick={() => toggleSort("last_price")}>LTP</th>
                  <th className={thR}>Value</th>
                  <th className={thR} onClick={() => toggleSort("pnl")}>P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2e]">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#a0a0a5] text-[13px]">No holdings found.</td></tr>
                )}
                {filtered.map((h) => {
                  const gain = h.pnl >= 0;
                  const pnlPct = h.average_price > 0 ? (h.pnl / (h.average_price * h.quantity)) * 100 : 0;
                  return (
                    <tr key={h.tradingsymbol} className="hover:bg-[#1c1c20] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SymbolAvatar symbol={h.tradingsymbol} />
                          <div>
                            <span className="font-semibold text-[14px] text-[#ededed]">{h.tradingsymbol}</span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#222226] text-[#a0a0a5] mono">{h.exchange}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right mono text-[#a0a0a5]">{h.quantity}</td>
                      <td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(h.average_price)}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(h.last_price)}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(h.last_price * h.quantity)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("inline-flex items-center gap-0.5 mono font-semibold", gain ? "text-[#5ee0a4]" : "text-[#ff7a6e]")}>
                          {gain ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {formatINR(Math.abs(h.pnl))}
                          <span className="text-[11px] opacity-80">({formatPercent(pnlPct)})</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {netPositions.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Open Positions" count={netPositions.length} />
          <div className="ab-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="bg-[#1c1c20]">
                  <tr>
                    <th className={thL}>Symbol</th>
                    <th className={thR}>Product</th>
                    <th className={thR}>Qty</th>
                    <th className={thR}>Avg</th>
                    <th className={thR}>Unrealised P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2e]">
                  {netPositions.map((p) => (
                    <tr key={`${p.tradingsymbol}-${p.product}`} className="hover:bg-[#1c1c20] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SymbolAvatar symbol={p.tradingsymbol} />
                          <div>
                            <span className="font-semibold text-[14px] text-[#ededed]">{p.tradingsymbol}</span>
                            <span className="ml-2 text-[10px] text-[#a0a0a5]">{p.exchange}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] mono px-1.5 py-0.5 rounded bg-[#222226] text-[#a0a0a5]">{p.product}</span>
                      </td>
                      <td className="px-4 py-3 text-right mono text-[#ededed]">{p.quantity}</td>
                      <td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(p.average_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("mono font-semibold", p.pnl >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]")}>
                          {p.pnl >= 0 ? "+" : ""}{formatINR(p.pnl)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {mfHoldings.length > 0 && (() => {
        const mfInvested = mfHoldings.reduce((s, h) => s + h.average_price * h.quantity, 0);
        const mfValue = mfHoldings.reduce((s, h) => s + h.last_price * h.quantity, 0);
        const mfPnL = mfValue - mfInvested;
        const mfPnLPct = mfInvested > 0 ? (mfPnL / mfInvested) * 100 : 0;
        return (
          <section className="space-y-4">
            <SectionHeader title="Mutual Funds" count={mfHoldings.length} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InlineStatCard label="MF Invested" value={formatINR(mfInvested)} />
              <InlineStatCard label="Current Value" value={formatINR(mfValue)} />
              <InlineStatCard label="Total P&L" value={formatINR(mfPnL)} sub={formatPercent(mfPnLPct)} tone={mfPnL >= 0 ? "positive" : "negative"} />
            </div>
            <div className="ab-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead className="bg-[#1c1c20]">
                    <tr>
                      <th className={thL}>Fund</th>
                      <th className={thR}>Units</th>
                      <th className={thR}>Avg NAV</th>
                      <th className={thR}>Current NAV</th>
                      <th className={thR}>Value</th>
                      <th className={thR}>P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2e]">
                    {mfHoldings.map((h) => {
                      const invested = h.average_price * h.quantity;
                      const pnl = h.last_price * h.quantity - invested;
                      const gain = pnl >= 0;
                      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                      const initials = (h.fund as string).split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                      return (
                        <tr key={`${h.tradingsymbol}-${h.folio ?? ""}`} className="hover:bg-[#1c1c20] transition-colors">
                          <td className="px-4 py-3 max-w-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-bold text-[#ff385c]">{initials}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-[14px] text-[#ededed] truncate max-w-[260px]">{h.fund}</p>
                                {h.folio && <p className="text-[11px] text-[#a0a0a5] mono mt-0.5">{h.folio}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right mono text-[#a0a0a5]">{h.quantity.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right mono text-[#a0a0a5]">{formatINR(h.average_price)}</td>
                          <td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(h.last_price)}</td>
                          <td className="px-4 py-3 text-right mono text-[#ededed]">{formatINR(h.last_price * h.quantity)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn("inline-flex items-center gap-0.5 mono font-semibold", gain ? "text-[#5ee0a4]" : "text-[#ff7a6e]")}>
                              {gain ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              {formatINR(Math.abs(pnl))}
                              <span className="text-[11px] opacity-80">({formatPercent(pnlPct)})</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
