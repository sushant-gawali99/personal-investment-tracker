// src/components/bank-accounts/category-breakdown-chart.tsx
"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CategoryBreakdownChart({ data, onSelect }: {
  data: { categoryId: string | null; name: string; total: number }[];
  onSelect: (categoryId: string | null) => void;
}) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Category Breakdown</h3>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" stroke="#a0a0a5" />
            <YAxis type="category" dataKey="name" stroke="#a0a0a5" />
            <Tooltip contentStyle={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
            <Bar dataKey="total" fill="#ff385c" onClick={(d) => onSelect((d as unknown as { categoryId: string | null }).categoryId)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
