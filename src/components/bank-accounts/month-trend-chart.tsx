// src/components/bank-accounts/month-trend-chart.tsx
"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MonthTrendChart({ data, onMonthClick }: {
  data: { month: string; spending: number; income: number }[];
  onMonthClick: (month: string) => void;
}) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Month-over-Month</h3>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="#2a2a2e" />
            <XAxis dataKey="month" stroke="#a0a0a5" />
            <YAxis stroke="#a0a0a5" />
            <Tooltip contentStyle={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
            <Legend />
            <Bar dataKey="spending" fill="#ef4444" onClick={(d) => onMonthClick((d as unknown as { month: string }).month)} />
            <Bar dataKey="income"   fill="#10b981" onClick={(d) => onMonthClick((d as unknown as { month: string }).month)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
