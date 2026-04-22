// src/components/bank-accounts/income-expense-chart.tsx
"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function IncomeExpenseChart({ data }: { data: { month: string; spending: number; income: number }[] }) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Income vs Expense</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid stroke="#2a2a2e" />
            <XAxis dataKey="month" stroke="#a0a0a5" />
            <YAxis stroke="#a0a0a5" />
            <Tooltip contentStyle={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
            <Legend />
            <Area type="monotone" dataKey="income"   stroke="#10b981" fill="#10b98133" />
            <Area type="monotone" dataKey="spending" stroke="#ef4444" fill="#ef444433" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
