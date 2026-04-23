// src/components/bank-accounts/category-breakdown-chart.tsx
"use client";
import { PieChart as PieIcon, TrendingDown } from "lucide-react";
import { formatINR, formatINRCompact } from "@/lib/format";

const CAT_COLORS = ["#ff385c", "#5aa9ff", "#5ee0a4", "#f5a524", "#a78bfa", "#ff8aa0", "#22d3ee", "#facc15"];

interface Item {
  categoryId: string | null;
  name: string;
  total: number;
}

export function CategoryBreakdownChart({
  data,
  onSelect,
  maxHeight,
}: {
  data: Item[];
  onSelect: (categoryId: string | null) => void;
  /** Optional explicit card height — set by the overview so this card
   *  lines up with MonthTrendChart, scrolling the list internally when
   *  there are more categories than fit. */
  maxHeight?: number;
}) {
  // Show all categories (not just top 8) since the card scrolls when maxHeight
  // is constrained by the row sibling.
  const sorted = [...data].sort((a, b) => b.total - a.total);
  const max = sorted.reduce((m, r) => Math.max(m, r.total), 0);
  const grandTotal = data.reduce((s, r) => s + r.total, 0);

  return (
    <div
      className="ab-card p-6 flex flex-col min-h-0"
      style={maxHeight ? { height: maxHeight } : undefined}
    >
      <div className="flex items-start justify-between mb-5 shrink-0">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Spending by Category</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-0.5">
            {data.length} categor{data.length === 1 ? "y" : "ies"} · {formatINRCompact(grandTotal)} total
          </p>
        </div>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(255,56,92,0.12)]">
          <PieIcon size={15} className="text-[#ff385c]" />
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-[#6e6e73]">
          <TrendingDown size={28} className="mb-2 opacity-40" />
          <p className="text-[13px]">No spending this period</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 -mr-3 pr-3 overflow-y-auto ab-scroll">
        <ul className="space-y-3">
          {sorted.map((item, i) => {
            const color = CAT_COLORS[i % CAT_COLORS.length];
            const pct = max > 0 ? (item.total / max) * 100 : 0;
            const sharePct = grandTotal > 0 ? (item.total / grandTotal) * 100 : 0;
            return (
              <li key={item.categoryId ?? item.name}>
                <button
                  onClick={() => onSelect(item.categoryId)}
                  className="w-full group text-left focus:outline-none"
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="flex-1 text-[13px] font-semibold text-[#ededed] truncate group-hover:text-[#ff385c] transition-colors">
                      {item.name}
                    </span>
                    <span className="mono text-[13px] font-semibold text-[#ededed]">
                      {formatINR(item.total)}
                    </span>
                    <span className="mono text-[11px] text-[#a0a0a5] w-[42px] text-right">
                      {sharePct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-[6px] rounded-full bg-[#1c1c20] overflow-hidden ml-5">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-125"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color} 0%, ${color}99 100%)` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        </div>
      )}
    </div>
  );
}
