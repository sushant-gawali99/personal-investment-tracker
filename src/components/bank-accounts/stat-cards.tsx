// src/components/bank-accounts/stat-cards.tsx
import { ArrowDownRight, ArrowUpRight, Receipt, Scale, type LucideIcon } from "lucide-react";
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

function StatCard({
  label,
  value,
  tone,
  delta,
  deltaBetterWhenDown,
  Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  tone?: string;
  delta?: number | null;
  deltaBetterWhenDown?: boolean;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}) {
  const hasDelta = typeof delta === "number" && isFinite(delta);
  const isPositive = hasDelta ? delta! >= 0 : false;
  const goodDirection = deltaBetterWhenDown ? !isPositive : isPositive;
  return (
    <div className="ab-card p-5 ab-card-interactive">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-full"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <p className={`mono text-[15px] sm:text-[24px] font-bold leading-tight ${tone ?? "text-[#ededed]"}`}>{value}</p>
      {hasDelta && (
        <p
          className={`text-[11px] sm:text-[12px] flex items-center gap-1 mt-1.5 font-medium ${
            goodDirection ? "text-[#5ee0a4]" : "text-[#ff7a6e]"
          }`}
        >
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta!).toFixed(1)}% vs last month
        </p>
      )}
      {!hasDelta && (
        <p className="text-[11px] sm:text-[12px] text-[#6e6e73] mt-1.5">No prior month</p>
      )}
    </div>
  );
}

export function StatCards({ spending, income, net, count, prev }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Spending"
        value={formatINR(spending)}
        delta={pct(spending, prev?.spending)}
        deltaBetterWhenDown
        Icon={ArrowDownRight}
        iconBg="rgba(255,122,110,0.12)"
        iconColor="#ff7a6e"
      />
      <StatCard
        label="Income"
        value={formatINR(income)}
        delta={pct(income, prev?.income)}
        Icon={ArrowUpRight}
        iconBg="rgba(94,224,164,0.12)"
        iconColor="#5ee0a4"
      />
      <StatCard
        label="Net Flow"
        value={(net >= 0 ? "+" : "") + formatINR(net)}
        tone={net >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}
        delta={pct(net, prev?.net)}
        Icon={Scale}
        iconBg="rgba(255,56,92,0.12)"
        iconColor="#ff385c"
      />
      <StatCard
        label="Transactions"
        value={count.toString()}
        delta={pct(count, prev?.count)}
        Icon={Receipt}
        iconBg="rgba(90,169,255,0.12)"
        iconColor="#5aa9ff"
      />
    </div>
  );
}
