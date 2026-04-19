"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Holding {
  tradingsymbol: string;
  last_price: number;
  quantity: number;
  pnl: number;
}

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export function TopHoldingsChart({ holdings }: { holdings: Holding[] }) {
  const top = [...holdings]
    .sort((a, b) => b.last_price * b.quantity - a.last_price * a.quantity)
    .slice(0, 8)
    .map((h) => ({
      name: h.tradingsymbol,
      value: Math.round(h.last_price * h.quantity),
      gain: h.pnl >= 0,
    }));

  if (!top.length) {
    return <div className="flex items-center justify-center h-48 text-[#6a6a6a] text-sm">No holdings</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#6a6a6a" }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#222222" }} tickLine={false} axisLine={false} width={74} />
        <Tooltip formatter={(value) => [fmt(Number(value)), "Value"]} cursor={{ fill: "rgba(34,34,34,0.04)" }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={600}>
          {top.map((entry, i) => (
            <Cell key={i} fill={entry.gain ? "#00a651" : "#c13515"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
