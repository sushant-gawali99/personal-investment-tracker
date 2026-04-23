// src/components/bank-accounts/month-trend-chart.tsx
"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { formatINRCompact } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

interface MonthRow {
  month: string;
  spending: number;
  income: number;
}

function formatMonthLabel(m: string): string {
  // "2026-04" → "Apr"
  const [y, mm] = m.split("-").map(Number);
  if (!y || !mm) return m;
  return new Date(y, mm - 1, 1).toLocaleString("en-IN", { month: "short" });
}

export function MonthTrendChart({ data, onMonthClick }: {
  data: MonthRow[];
  onMonthClick: (month: string) => void;
}) {
  return (
    <div className="ab-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Month-over-Month</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-0.5">Click a bar to jump to that month</p>
        </div>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(90,169,255,0.12)]">
          <BarChart3 size={15} className="text-[#5aa9ff]" />
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-[#a0a0a5] mb-3 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#5ee0a4" }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#ff7a6e" }} />
          Spending
        </span>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mtrend-spend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a6e" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#ff7a6e" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="mtrend-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5ee0a4" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#5ee0a4" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              tick={{ fontSize: 11, fill: "#a0a0a5" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatINRCompact(Number(v))}
              tick={{ fontSize: 11, fill: "#a0a0a5" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={(
                <ChartTooltip
                  series={[
                    { dataKey: "income", label: "Income", color: "#5ee0a4" },
                    { dataKey: "spending", label: "Spending", color: "#ff7a6e" },
                  ]}
                  title={(l) => formatMonthLabel(String(l ?? ""))}
                />
              )}
            />
            <Bar
              dataKey="income"
              fill="url(#mtrend-income)"
              radius={[4, 4, 0, 0]}
              onClick={(d) => onMonthClick((d as unknown as { month: string }).month)}
              animationDuration={600}
              cursor="pointer"
            />
            <Bar
              dataKey="spending"
              fill="url(#mtrend-spend)"
              radius={[4, 4, 0, 0]}
              onClick={(d) => onMonthClick((d as unknown as { month: string }).month)}
              animationDuration={600}
              cursor="pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
