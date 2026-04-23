// src/components/bank-accounts/income-expense-chart.tsx
"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { formatINRCompact } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

interface Row {
  month: string;
  spending: number;
  income: number;
}

function formatMonthLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  if (!y || !mm) return m;
  return new Date(y, mm - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

export function IncomeExpenseChart({ data }: { data: Row[] }) {
  const totalIncome = data.reduce((s, r) => s + r.income, 0);
  const totalSpend = data.reduce((s, r) => s + r.spending, 0);
  const net = totalIncome - totalSpend;

  return (
    <div className="ab-card p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Income vs Expense</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-0.5">Last {data.length} months</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Net</p>
            <p className={`mono text-[15px] font-semibold ${net >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}>
              {net >= 0 ? "+" : ""}{formatINRCompact(net)}
            </p>
          </div>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(94,224,164,0.12)]">
            <Activity size={15} className="text-[#5ee0a4]" />
          </span>
        </div>
      </div>
      <div style={{ width: "100%", height: 230 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ie-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5ee0a4" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#5ee0a4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ie-spend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a6e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ff7a6e" stopOpacity={0} />
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
              cursor={{ stroke: "#3a3a3f", strokeDasharray: "3 3" }}
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
            <Area
              type="monotone"
              dataKey="income"
              stroke="#5ee0a4"
              strokeWidth={2}
              fill="url(#ie-income)"
              dot={false}
              animationDuration={600}
            />
            <Area
              type="monotone"
              dataKey="spending"
              stroke="#ff7a6e"
              strokeWidth={2}
              fill="url(#ie-spend)"
              dot={false}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
