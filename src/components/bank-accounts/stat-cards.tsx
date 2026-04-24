// src/components/bank-accounts/stat-cards.tsx
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatINR } from "@/lib/format";

interface Props {
  spending: number;
  income: number;
  net: number;
  count: number;
  prev?: { spending: number; income: number; net: number; count: number };
}

function pct(curr: number, prev: number | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function StatItem({
  label,
  value,
  tone,
  delta,
  deltaBetterWhenDown,
}: {
  label: string;
  value: string;
  tone?: string;
  delta?: number | null;
  deltaBetterWhenDown?: boolean;
}) {
  const hasDelta = typeof delta === "number" && isFinite(delta);
  const isPositive = hasDelta ? delta! >= 0 : false;
  const goodDirection = deltaBetterWhenDown ? !isPositive : isPositive;
  return (
    <div className="flex-1 min-w-0 px-5 py-4">
      <p className="text-[10px] text-[#6e6e73] uppercase tracking-widest font-semibold mb-1.5">{label}</p>
      <p className={`mono text-[20px] font-bold leading-none tracking-tight ${tone ?? "text-[#ededed]"}`}>{value}</p>
      {hasDelta ? (
        <p className={`text-[11px] flex items-center gap-0.5 mt-1.5 font-medium ${goodDirection ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}>
          {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {Math.abs(delta!).toFixed(1)}% vs last month
        </p>
      ) : (
        <p className="text-[11px] text-[#3a3a3e] mt-1.5">No prior month</p>
      )}
    </div>
  );
}

export function StatCards({ spending, income, net, count, prev }: Props) {
  return (
    <div className="flex flex-col sm:flex-row bg-[#17171a] border border-[#252528] rounded-2xl overflow-hidden">
      <StatItem
        label="Spending"
        value={formatINR(spending)}
        delta={pct(spending, prev?.spending)}
        deltaBetterWhenDown
      />
      <div className="hidden sm:block w-px bg-[#252528] self-stretch" />
      <div className="block sm:hidden h-px bg-[#252528] mx-5" />
      <StatItem
        label="Income"
        value={formatINR(income)}
        delta={pct(income, prev?.income)}
      />
      <div className="hidden sm:block w-px bg-[#252528] self-stretch" />
      <div className="block sm:hidden h-px bg-[#252528] mx-5" />
      <StatItem
        label="Net Flow"
        value={(net >= 0 ? "+" : "") + formatINR(net)}
        tone={net >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}
        delta={pct(net, prev?.net)}
      />
      <div className="hidden sm:block w-px bg-[#252528] self-stretch" />
      <div className="block sm:hidden h-px bg-[#252528] mx-5" />
      <StatItem
        label="Transactions"
        value={count.toString()}
        delta={pct(count, prev?.count)}
      />
    </div>
  );
}
